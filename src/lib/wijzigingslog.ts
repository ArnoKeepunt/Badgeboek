import { useMemo } from "react";
import { RATING_EMPTY_LABEL, RATING_LABEL } from "./ratings";
import { geschiedenisVoor, laatsteWijziging, useStore } from "./store";
import type { AuditLog, AuditRegel, Deelevaluatie, Mentor, Rating } from "./types";

/**
 * Toont de wijzigingsgeschiedenis van een evaluatiecel: wie ze wanneer wijzigde en van→naar.
 * De append-only log leeft in `store.auditLog` (sleutel = de kleur-/deelSleutel van die cel).
 * Seed-/demodata heeft geen geschiedenis.
 */

const datumFmt = new Intl.DateTimeFormat("nl-BE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Compacter, zonder jaartal — voor de geschiedenislijst. */
const momentFmt = new Intl.DateTimeFormat("nl-BE", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Eén regel klaar om te tonen: naam + moment op regel 1, de overgang op regel 2. */
export interface GeschiedenisRegel {
  wie: string;
  moment: string;
  overgang: string;
}

const noemGebruiker = (mentoren: Mentor[], id: string | undefined): string => {
  if (id === undefined) return "onbekend";
  if (id === "") return "Beheerder";
  const m = mentoren.find((x) => x.id === id);
  return m ? `${m.voornaam} ${m.naam}` : id;
};

/**
 * De naam van wie een geschiedenisregel schreef: bij voorkeur de meegeschreven `doorNaam`
 * (Firebase-personeelslid), anders de demo-mentor opgezocht op id.
 */
const naamVoorRegel = (regel: AuditRegel, mentoren: Mentor[]): string =>
  regel.doorNaam?.trim() || noemGebruiker(mentoren, regel.door);

/** Kleur-`Rating` (of "" = leeg) → leesbaar label; notitietekst → tussen aanhalingstekens. */
const waardeTekst = (veld: AuditRegel["veld"], v: string): string => {
  if (veld === "kleur") return v === "" ? RATING_EMPTY_LABEL : RATING_LABEL[v as Rating];
  return v === "" ? "(leeg)" : `“${v.length > 40 ? `${v.slice(0, 40)}…` : v}”`;
};

/** "Geel aangepast naar Groen" / "Ingesteld op Groen" / "Notitie toegevoegd: …". */
function overgangTekst(regel: AuditRegel): string {
  const van = waardeTekst(regel.veld, regel.van);
  const naar = waardeTekst(regel.veld, regel.naar);
  if (regel.veld === "kleur") {
    if (regel.van === "") return `Ingesteld op ${naar}`;
    if (regel.naar === "") return `Gewist (was ${van})`;
    return `${van} aangepast naar ${naar}`;
  }
  if (regel.van === "") return `Notitie toegevoegd: ${naar}`;
  if (regel.naar === "") return "Notitie verwijderd";
  return `Notitie ${van} aangepast naar ${naar}`;
}

/** Eén geschiedenisregel als platte tekst (voor een tooltip). */
export function beschrijfAuditRegel(regel: AuditRegel, mentoren: Mentor[]): string {
  const wie = naamVoorRegel(regel, mentoren);
  return `${wie} · ${datumFmt.format(new Date(regel.op))} · ${overgangTekst(regel)}`;
}

/** Eén geschiedenisregel als weergavemodel (naam / moment / overgang). */
export function toonRegel(regel: AuditRegel, mentoren: Mentor[]): GeschiedenisRegel {
  return {
    wie: naamVoorRegel(regel, mentoren),
    moment: momentFmt.format(new Date(regel.op)),
    overgang: overgangTekst(regel),
  };
}

/**
 * Wie de laatste kleurbeoordeling van een cel ingaf — voor de leerlingweergave ("Beoordeeld
 * door …"). `null` als er geen geschiedenis is (seed-/demodata) of de laatste wijziging niet aan
 * een persoon toe te wijzen is (beheerder(smodus), `door === ""`), of de laatste wijziging een
 * wissing was.
 */
export function beoordelaarVoor(
  auditLog: AuditLog,
  mentoren: Mentor[],
  sleutel: string,
): string | null {
  // De laatste regel die een kleur zette (niet: een notitie, niet: een wissing).
  const kleurRegels = geschiedenisVoor(auditLog, sleutel).filter(
    (r) => r.veld === "kleur" && r.naar !== "",
  );
  const regel = kleurRegels[kleurRegels.length - 1];
  if (!regel || !regel.door) return null;
  return naamVoorRegel(regel, mentoren);
}

/** Hook: `(sleutel) => "naam van de beoordelaar"` of `null`, voor de leerlingweergave. */
export function useBeoordelaar(): (sleutel: string) => string | null {
  const { auditLog, mentoren } = useStore();
  return useMemo(
    () => (sleutel: string) => beoordelaarVoor(auditLog, mentoren, sleutel),
    [auditLog, mentoren],
  );
}

export function beschrijfWijziging(
  auditLog: AuditLog,
  mentoren: Mentor[],
  sleutel: string,
): string | null {
  const regel = laatsteWijziging(auditLog, sleutel);
  return regel ? `Laatst gewijzigd — ${beschrijfAuditRegel(regel, mentoren)}` : null;
}

/** Hook: `(sleutel) => "Laatst gewijzigd — …"` of `null` (voor een tooltip). */
export function useWijzigingLabel(): (sleutel: string) => string | null {
  const { auditLog, mentoren } = useStore();
  return useMemo(
    () => (sleutel: string) => beschrijfWijziging(auditLog, mentoren, sleutel),
    [auditLog, mentoren],
  );
}

/** Hook: `(sleutel) => GeschiedenisRegel[]` — de volledige geschiedenis, nieuwste eerst. */
export function useGeschiedenis(): (sleutel: string) => GeschiedenisRegel[] {
  const { auditLog, mentoren } = useStore();
  return useMemo(
    () => (sleutel: string) =>
      [...geschiedenisVoor(auditLog, sleutel)].reverse().map((r) => toonRegel(r, mentoren)),
    [auditLog, mentoren],
  );
}

/**
 * "Laatst gewijzigd door … · …" voor het deelevaluatie-record zelf (titel/datum/gekoppelde
 * badges/toelichting). `null` voor seed-data zonder stempel.
 */
export function beschrijfDeelevaluatieWijziging(d: Deelevaluatie, mentoren: Mentor[]): string | null {
  if (!d.gewijzigdOp) return null;
  const wie = noemGebruiker(mentoren, d.gewijzigdDoor);
  const gemaakt =
    d.aangemaaktOp && d.aangemaaktOp !== d.gewijzigdOp
      ? ` (aangemaakt ${datumFmt.format(new Date(d.aangemaaktOp))})`
      : "";
  return `Laatst gewijzigd door ${wie} · ${datumFmt.format(new Date(d.gewijzigdOp))}${gemaakt}`;
}

/** Hook: `(deelevaluatie) => "Laatst gewijzigd door … · …"` of `null`. */
export function useDeelevaluatieWijzigingLabel(): (d: Deelevaluatie) => string | null {
  const { mentoren } = useStore();
  return useMemo(
    () => (d: Deelevaluatie) => beschrijfDeelevaluatieWijziging(d, mentoren),
    [mentoren],
  );
}
