import { useSyncExternalStore } from "react";
import {
  GEBUNDELD,
  GEBUNDELD_RUW,
  alleCursussen,
  alleLeerdoelen,
  type CurriculumRuw,
  cursusVanLeerdoel,
  cursusVanNode,
  zetCurriculum,
} from "./curriculum";
import { type PersistedStore, type RauweStore, maakPersistentie, sessieOpslag } from "./data";
import {
  deelKleuren as seedDeelKleuren,
  seedDeelevaluaties,
  doelKleuren as seedKleuren,
  seedMeldingen,
  mentoren as seedMentoren,
  students as seedStudents,
} from "./mockData";
import type { Minimumdoel } from "./minimumdoelen";
import { stroomVan } from "./leerlingen";
import { metRubriekWijzigingen, rubrieken as GEBUNDELDE_RUBRIEKEN } from "./rubrieken";
import {
  AFGESLOTEN_SCHOOLJAREN,
  HUIDIG_SCHOOLJAAR,
  SCHOOLJAREN,
  eerdereSchooljaren,
  isAfgesloten,
  zetAfgeslotenSchooljaren,
} from "./schooljaar";
import {
  GEBUNDELDE_VESTIGINGEN,
  type Vestiging,
  isGeldigeVestiging,
  vestigingSlug,
  zetVestigingen,
} from "./vestigingen";
import type {
  AuditLog,
  AuditRegel,
  Basisrol,
  DeelKleuren,
  DeelNotities,
  Deelevaluatie,
  DoelKleuren,
  Groep,
  Melding,
  Mentor,
  Notitie,
  Notities,
  Rating,
  Rubriek,
  Sessie,
  Stroom,
  Student,
} from "./types";
import {
  LEGE_NOTITIE,
  STROMEN,
  deelSleutel,
  doelSleutel,
  notitieSleutel,
} from "./types";

/**
 * In-memory reactieve store: elke mutatie vervangt `state` door een nieuw object zodat
 * `useSyncExternalStore` de abonnees opnieuw rendert. Hier zitten de domeinregels (seed
 * eronder mergen, meldingen, `gewist`, afgesloten-schooljaar-guards).
 *
 * Waar de data *fysiek* leeft weet deze module niet: dat gaat via een `BadgeboekPersistentie`
 * (`src/lib/data/`). Nu localStorage, later Firebase/Supabase — zonder wijziging aan de pagina's.
 */

const opslag = maakPersistentie();

/**
 * De volledige store = alles wat bewaard wordt (`PersistedStore`, veldbeschrijvingen staan in
 * `src/lib/data/persistentie.ts`) + de per-tab `sessie` die buiten de gedeelde opslag leeft.
 */
interface State extends PersistedStore {
  /** Wie er is aangemeld (per browsertab). */
  sessie: Sessie | null;
}

const MAX_MELDINGEN = 120;
const MAX_GEWIST = 1000;

/** De seed-/demodata. Dit is de `PersistedStore`, dus zonder `sessie`. */
const seed = (): PersistedStore => ({
  students: seedStudents,
  mentoren: seedMentoren,
  vestigingen: null,
  kleuren: seedKleuren,
  notities: {},
  groepen: [],
  schooljaar: HUIDIG_SCHOOLJAAR,
  afgeslotenSchooljaren: null,
  matrixStromen: ["1A"],
  matrixCursus: "",
  doelWijzigingen: {},
  doelenImport: null,
  rubriekWijzigingen: {},
  rubriekenOverride: null,
  curriculumOverride: null,
  deelevaluaties: seedDeelevaluaties,
  deelKleuren: seedDeelKleuren,
  deelNotities: {},
  auditLog: {},
  meldingen: seedMeldingen,
  meldingGezien: {},
  gewist: [],
});

/**
 * De ruwe (mogelijk onvolledige/oude) opslag samenvoegen met de seed-data + migraties.
 * Levert de `PersistedStore` (zonder `sessie`, die komt er los bij).
 */
function verwerkRauw(bewaard: RauweStore | null): PersistedStore {
  const standaard = seed();
  if (!bewaard) return standaard;

  const basis: PersistedStore = { ...standaard, ...bewaard };
  // De seed-evaluaties en -notities blijven onder de bewaarde waarden liggen: zo verschijnt
  // nieuwe demo-data (bv. voor 1B/2A/3A-leerlingen) zonder dat een eigen kleur of notitie
  // sneuvelt — een handmatige waarde wint altijd van de seed.
  basis.kleuren = { ...standaard.kleuren, ...(bewaard.kleuren ?? {}) };
  basis.notities = { ...standaard.notities, ...(bewaard.notities ?? {}) };
  basis.deelKleuren = { ...standaard.deelKleuren, ...(bewaard.deelKleuren ?? {}) };
  basis.deelNotities = { ...standaard.deelNotities, ...(bewaard.deelNotities ?? {}) };
  // Wijzigingsgeschiedenis: de seed heeft er geen, dus gewoon de bewaarde overnemen.
  basis.auditLog = { ...(bewaard.auditLog ?? {}) };
  // Bewust gewiste kleuren blijven weg, ook al zit er seed-data onder.
  basis.gewist = Array.isArray(bewaard.gewist) ? bewaard.gewist : [];
  for (const k of basis.gewist) {
    delete basis.kleuren[k];
    delete basis.deelKleuren[k];
  }
  // De voorbeeld-deelevaluaties/-meldingen blijven staan tot er echte data is. Nieuwe seed-
  // deelevaluaties (bv. per graad) schuiven onder de bewaarde: aangemaakte/gewijzigde blijven,
  // ontbrekende seed-rijen komen erbij (op id).
  if (Array.isArray(bewaard.deelevaluaties)) {
    const aanwezig = new Set(bewaard.deelevaluaties.map((d) => d.id));
    basis.deelevaluaties = [
      ...bewaard.deelevaluaties,
      ...standaard.deelevaluaties.filter((d) => !aanwezig.has(d.id)),
    ];
  } else {
    basis.deelevaluaties = standaard.deelevaluaties;
  }
  if (!Array.isArray(bewaard.meldingen)) basis.meldingen = standaard.meldingen;
  if (!bewaard.meldingGezien) basis.meldingGezien = standaard.meldingGezien;
  // Migratie: vroeger één stroom (`matrixStroom`), nu een lijst (`matrixStromen`).
  if (!Array.isArray(bewaard.matrixStromen)) {
    basis.matrixStromen = bewaard.matrixStroom ? [bewaard.matrixStroom] : standaard.matrixStromen;
  }
  // De database-versie van de badges (alleen door de beheerder bewerkbaar, `null` = de bundel).
  basis.curriculumOverride = geldigCurriculum(bewaard.curriculumOverride) ?? null;
  zetCurriculum(basis.curriculumOverride);
  // De database-versie van de vestigingen (`null` = de bundel).
  basis.vestigingen = geldigeVestigingen(bewaard.vestigingen);
  zetVestigingen(basis.vestigingen);
  // De database-versie van de uitgeschreven rubrics (`null` = de bundel).
  basis.rubriekenOverride = geldigeRubrieken(bewaard.rubriekenOverride);
  basis.afgeslotenSchooljaren = Array.isArray(bewaard.afgeslotenSchooljaren)
    ? bewaard.afgeslotenSchooljaren.filter((s): s is string => typeof s === "string")
    : null;
  zetAfgeslotenSchooljaren(basis.afgeslotenSchooljaren);
  schoonOrphans(basis);
  return basis;
}

/** Vormcontrole op de opgeslagen vestigingenlijst; `null` = terugvallen op de bundel. */
function geldigeVestigingen(d: unknown): Vestiging[] | null {
  return Array.isArray(d) && d.length > 0 && d.every(isGeldigeVestiging) ? (d as Vestiging[]) : null;
}

/** Vormcontrole op de opgeslagen rubriekenlijst; `null` = terugvallen op de bundel. */
function geldigeRubrieken(d: unknown): Rubriek[] | null {
  return Array.isArray(d) &&
    d.length > 0 &&
    d.every(
      (r): r is Rubriek =>
        !!r &&
        typeof r === "object" &&
        typeof (r as Rubriek).id === "string" &&
        typeof (r as Rubriek).naam === "string" &&
        !!(r as Rubriek).criteria,
    )
    ? (d as Rubriek[])
    : null;
}

/** Snelle vormcontrole zodat een kapotte database-versie de app niet breekt (val terug op de bundel). */
export function geldigCurriculum(d: unknown): CurriculumRuw | null {
  if (!d || typeof d !== "object") return null;
  const c = d as Partial<CurriculumRuw>;
  return Array.isArray(c.cursussen) &&
    Array.isArray(c.badges) &&
    c.cursussen.length > 0 &&
    c.badges.length > 0
    ? (c as CurriculumRuw)
    : null;
}

/**
 * Opkuis-migratie. Sinds de badges herwerkt zijn uit `deelevaluaties_alle-graden-2.xlsx`
 * (cursus "Basisvaardigheden" weg, geen cursus-/rubric-/subgroep-graadsbadges meer, badge-ids
 * hernummerd) wijzen oude opgeslagen sleutels naar badges die niet meer bestaan. Die worden
 * hier weggegooid. Idempotent — draait bij elke load.
 */
/**
 * Gememoïseerde "geldige id/naam"-sets voor `schoonOrphans`. Rebuild alleen als het actieve
 * curriculum wisselt (`alleLeerdoelen()` geeft dan een andere array-ref terug) — anders bouwden
 * we ~2000-entry Sets bij élke live-update.
 */
let _geldigCache: {
  leerdoelen: unknown;
  badges: Set<string>;
  cursusIds: Set<string>;
  cursusNamen: Set<string>;
} | null = null;
function geldigeSets() {
  const leerdoelen = alleLeerdoelen();
  if (_geldigCache?.leerdoelen !== leerdoelen) {
    _geldigCache = {
      leerdoelen,
      badges: new Set([...GEBUNDELD.leerdoelen.map((l) => l.id), ...leerdoelen.map((l) => l.id)]),
      cursusIds: new Set([
        ...GEBUNDELD.cursussen.map((c) => c.id),
        ...alleCursussen().map((c) => c.id),
      ]),
      cursusNamen: new Set([
        ...GEBUNDELD.cursussen.map((c) => c.naam),
        ...alleCursussen().map((c) => c.naam),
      ]),
    };
  }
  return _geldigCache;
}

function schoonOrphans(basis: PersistedStore): void {
  // Geldig = in de bundel OF in de database-versie. Zo wist het verwijderen van een badge uit
  // de database níét meteen alle evaluaties ervan (die komen terug als de badge weer opduikt);
  // enkel wat in geen van beide zit (bv. de oude Basisvaardigheden-badges) wordt opgekuist.
  const { badges: geldigeBadges, cursusIds: geldigeCursusIds, cursusNamen: geldigeCursusNamen } =
    geldigeSets();

  const badgeVanSleutel = (sleutel: string): string => {
    const i1 = sleutel.indexOf(":");
    const i2 = sleutel.indexOf(":", i1 + 1);
    return i2 === -1 ? "" : sleutel.slice(i2 + 1);
  };
  const snoeiKleurMap = <T,>(map: Record<string, T>): Record<string, T> => {
    const uit: Record<string, T> = {};
    for (const [k, v] of Object.entries(map)) {
      if (geldigeBadges.has(badgeVanSleutel(k))) uit[k] = v;
    }
    return uit;
  };

  basis.kleuren = snoeiKleurMap(basis.kleuren);
  basis.notities = snoeiKleurMap(basis.notities);
  // `auditLog` (geschiedenis) blijft ongemoeid: verweesde regels worden nooit getoond.

  basis.deelevaluaties = basis.deelevaluaties.map((d) => ({
    ...d,
    // Migratie: deelbadges van vóór de vestiging-scoping → "" (alle vestigingen).
    vestiging: d.vestiging ?? "",
    leerdoelIds: d.leerdoelIds.filter((id) => geldigeBadges.has(id)),
  }));
  const deIds = new Set(basis.deelevaluaties.map((d) => d.id));
  const snoeiDeelMap = <T,>(map: Record<string, T>): Record<string, T> => {
    const uit: Record<string, T> = {};
    for (const [k, v] of Object.entries(map)) {
      if (deIds.has(k.slice(0, k.lastIndexOf(":")))) uit[k] = v;
    }
    return uit;
  };
  basis.deelKleuren = snoeiDeelMap(basis.deelKleuren);
  basis.deelNotities = snoeiDeelMap(basis.deelNotities);

  basis.meldingen = basis.meldingen.map((m) =>
    m.cursusId && !geldigeCursusIds.has(m.cursusId) ? { ...m, cursusId: "" } : m,
  );
  if (basis.matrixCursus && !geldigeCursusNamen.has(basis.matrixCursus)) {
    basis.matrixCursus = "";
  }
  basis.gewist = basis.gewist.filter((k) => geldigeBadges.has(badgeVanSleutel(k)));
}

function load(): State {
  let bewaard: RauweStore | null = null;
  try {
    bewaard = opslag.laadDirect();
  } catch {
    // opslag onbereikbaar — terugvallen op de seed
  }
  return { ...verwerkRauw(bewaard), sessie: sessieOpslag.laad() };
}

let state: State = load();
const listeners = new Set<() => void>();

function commit(next: State) {
  const vorige = state;
  state = next;
  zetCurriculum(state.curriculumOverride);
  zetVestigingen(state.vestigingen);
  zetAfgeslotenSchooljaren(state.afgeslotenSchooljaren);
  const { sessie, ...rest } = state;
  void opslag.bewaar(rest);
  // De doelen-/rubriek-overlays (`instellingen/overlays`) rijden in firebase-modus NIET mee in
  // `bewaar()` (beheerder-only doc) — apart wegschrijven zodra ze wijzigen.
  if (
    vorige.doelWijzigingen !== state.doelWijzigingen ||
    vorige.doelenImport !== state.doelenImport ||
    vorige.rubriekWijzigingen !== state.rubriekWijzigingen
  ) {
    void opslag.schrijfOverlays?.({
      doelWijzigingen: state.doelWijzigingen,
      doelenImport: state.doelenImport,
      rubriekWijzigingen: state.rubriekWijzigingen,
    });
  }
  sessieOpslag.bewaar(sessie);
  listeners.forEach((notify) => notify());
}

// Data die elders wijzigt (andere browsertab nu, straks een realtime backend) overnemen —
// zonder terug te schrijven, anders krijg je een lus.
opslag.abonneer?.((rauw) => {
  try {
    // "Hydration": nooit stil terugvallen van de database-versie naar de ingebouwde bundel.
    // Hadden we een geldig DB-curriculum / een DB-vestigingenlijst, en komt die nu niet mee
    // (netwerkhapering, permissiefout, half gesynchroniseerd), dan houden we de laatst geziene
    // versie. De bundel geldt enkel bij de eerste start of na een bewuste keuze van de beheerder
    // (die loopt via `commit`, niet hierlangs).
    const behoudCurriculum =
      !geldigCurriculum(rauw.curriculumOverride) && Boolean(state.curriculumOverride);
    const behoudVestigingen =
      !geldigeVestigingen(rauw.vestigingen) && Boolean(state.vestigingen);
    const behoudRubrieken =
      !geldigeRubrieken(rauw.rubriekenOverride) && Boolean(state.rubriekenOverride);
    const gehydrateerd: RauweStore = {
      ...rauw,
      curriculumOverride: behoudCurriculum ? state.curriculumOverride : rauw.curriculumOverride,
      vestigingen: behoudVestigingen ? state.vestigingen : rauw.vestigingen,
      rubriekenOverride: behoudRubrieken ? state.rubriekenOverride : rauw.rubriekenOverride,
    };
    state = { ...verwerkRauw(gehydrateerd), sessie: state.sessie };
    listeners.forEach((notify) => notify());
  } catch {
    // onbruikbare payload van elders — huidige state behouden
  }
});

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

// --- Gewiste kleuren (blijven weg bij herladen) -------------------------

function pasGewistAan(gewist: string[], sleutel: string, kleur: Rating | null): string[] {
  const erin = gewist.includes(sleutel);
  if (kleur) return erin ? gewist.filter((x) => x !== sleutel) : gewist;
  return erin ? gewist : [...gewist, sleutel].slice(-MAX_GEWIST);
}

// --- Meldingen (leerling-meldingencentrum) ------------------------------

const cursusInfoVoorNode = (nodeId: string) => {
  const c = cursusVanNode(nodeId);
  return { cursusId: c?.id ?? "", cursusNaam: c?.naam ?? "je badges" };
};

/**
 * Voeg een melding toe. Is er voor dezelfde leerling + cursus + soort al een ongelezen melding,
 * dan wordt die opgehoogd (teller + tijdstip) i.p.v. een nieuwe regel toe te voegen.
 */
function metMelding(
  lijst: Melding[],
  base: Omit<Melding, "id" | "ts" | "aantal">,
): Melding[] {
  const ts = Date.now();
  const gezien = state.meldingGezien[base.studentId] ?? 0;
  const idx = lijst.findIndex(
    (m) =>
      m.studentId === base.studentId &&
      m.cursusId === base.cursusId &&
      m.soort === base.soort &&
      m.ts > gezien,
  );
  if (idx >= 0) {
    const bij = { ...lijst[idx], ts, aantal: lijst[idx].aantal + 1 };
    return [bij, ...lijst.slice(0, idx), ...lijst.slice(idx + 1)];
  }
  const id = `m${ts.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return [{ id, ts, aantal: 1, ...base }, ...lijst].slice(0, MAX_MELDINGEN);
}

/** Meldingen voor één leerling, nieuwste eerst. */
export const meldingenVoor = (meldingen: Melding[], studentId: string): Melding[] =>
  meldingen.filter((m) => m.studentId === studentId);

/** Aantal ongelezen meldingen voor één leerling. */
export const aantalOngelezen = (
  meldingen: Melding[],
  meldingGezien: Record<string, number>,
  studentId: string,
): number => {
  const gezien = meldingGezien[studentId] ?? 0;
  return meldingen.filter((m) => m.studentId === studentId && m.ts > gezien).length;
};

/** Markeer alle meldingen van een leerling als gelezen. */
export function markMeldingenGezien(studentId: string) {
  commit({
    ...state,
    meldingGezien: { ...state.meldingGezien, [studentId]: Date.now() },
  });
}

/** Lees de volledige store; rendert opnieuw bij elke wijziging. */
export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state);
}

// --- Wijzigingsgeschiedenis: wie wijzigde een evaluatiecel (kleur of notitie) wanneer --------

/**
 * Het personeelslid dat via een Firebase-login is aangemeld (id = e-mailadres). Gezet door
 * `src/lib/firebaseAuth.ts` zodra het `gebruikers`-account geladen is. In local-modus / zonder
 * login blijft dit `null` en valt de actor terug op de demo-`sessie`.
 */
let firebaseActor: { id: string; naam: string } | null = null;

/** Koppel (of ontkoppel, met `null`) het aangemelde personeelslid aan de wijzigingsgeschiedenis. */
export function zetFirebaseActor(actor: { id: string; naam: string } | null): void {
  firebaseActor = actor;
}

/**
 * Wie handelt er nu — id + naam. Volgorde: de demo-"bekijk als"-sessie (beheerder test een
 * mentor/leerling), anders het aangemelde Firebase-personeelslid, anders de beheerder(smodus)
 * (id "", geen naam).
 */
function huidigeActor(): { id: string; naam: string } {
  const s = state.sessie;
  if (s) {
    if (s.rol === "mentor") {
      const m = state.mentoren.find((x) => x.id === s.id);
      return { id: s.id, naam: m ? `${m.voornaam} ${m.naam}` : s.id };
    }
    return { id: s.id, naam: s.id };
  }
  return firebaseActor ?? { id: "", naam: "" };
}

/** De id van wie nu handelt, of "" voor de beheerder(smodus). */
const huidigeGebruiker = (): string => huidigeActor().id;

/** Ruime bovengrens per cel — de oudste regels vallen weg (het is een demo/prototype). */
const MAX_AUDIT_PER_CEL = 50;

type Wijziging = { sleutel: string; veld: AuditRegel["veld"]; van: string; naar: string };

/** Voeg één of meer geschiedenisregels toe (één tijdstempel voor de hele beurt). */
function metAudit(auditLog: AuditLog, wijzigingen: Wijziging[]): AuditLog {
  if (wijzigingen.length === 0) return auditLog;
  const op = Date.now();
  const actor = huidigeActor();
  const next = { ...auditLog };
  for (const w of wijzigingen) {
    const bestaand = next[w.sleutel] ?? [];
    next[w.sleutel] = [
      ...bestaand,
      { op, door: actor.id, doorNaam: actor.naam || undefined, veld: w.veld, van: w.van, naar: w.naar },
    ].slice(-MAX_AUDIT_PER_CEL);
  }
  return next;
}

/** De volledige geschiedenis van een evaluatiecel (oudste eerst), of een lege lijst. */
export function geschiedenisVoor(auditLog: AuditLog, sleutel: string): AuditRegel[] {
  return auditLog[sleutel] ?? [];
}

/** De laatste wijziging van een evaluatiecel, of `null`. */
export function laatsteWijziging(auditLog: AuditLog, sleutel: string): AuditRegel | null {
  const g = auditLog[sleutel];
  return g && g.length > 0 ? g[g.length - 1] : null;
}

/** Korte weergave van een notitie voor de geschiedenis (zichtbare tekst, of "(verborgen)"). */
const notitieWeergave = (n: Notitie): string =>
  n.zichtbaar || (n.verborgen ? "(verborgen notitie)" : "");

/**
 * Zet (of wis, met `null`) de kleur van een badge voor één leerling in een schooljaar.
 * `nodeId` is een leerdoel-id (badge).
 */
export function setDoelKleur(
  schooljaar: string,
  studentId: string,
  nodeId: string,
  kleur: Rating | null,
) {
  // Een afgesloten schooljaar staat vast: negeer wijzigingen.
  if (isAfgesloten(schooljaar)) return;
  const sleutel = doelSleutel(schooljaar, studentId, nodeId);
  const oud = state.kleuren[sleutel] ?? null;
  const gewijzigd = oud !== kleur;
  const verandert = kleur !== null && oud !== kleur;
  const kleuren = { ...state.kleuren };
  if (kleur) kleuren[sleutel] = kleur;
  else delete kleuren[sleutel];
  const meldingen =
    verandert && schooljaar === HUIDIG_SCHOOLJAAR
      ? metMelding(state.meldingen, {
          studentId,
          soort: "kleur",
          ...cursusInfoVoorNode(nodeId),
        })
      : state.meldingen;
  commit({
    ...state,
    kleuren,
    auditLog: gewijzigd
      ? metAudit(state.auditLog, [
          { sleutel, veld: "kleur", van: oud ?? "", naar: kleur ?? "" },
        ])
      : state.auditLog,
    meldingen,
    gewist: pasGewistAan(state.gewist, sleutel, kleur),
  });
}

// --- Overname van kleuren binnen dezelfde graad -------------------------
//
// Een graad loopt over twee schooljaren. Een leerling die aan het 2e jaar van zijn graad
// begint, heeft nog niet al zijn badges behaald — de stand van vorig schooljaar telt gewoon
// verder. Een leerling die van graad wisselt krijgt nieuwe badges en start blanco.
//
// Er is geen historiek van "leerjaar per schooljaar", dus leiden we "zat vorig jaar in
// dezelfde graad" data-gedreven af: heeft de leerling voor dat schooljaar minstens één
// opgeslagen kleur voor een badge van zijn *huidige* stroom? (Badge-id's beginnen met de
// stroomcode, bv. `2A-…`.) Zo ja → overnemen; zo nee → graadgrens, blanco.

const stroomVanBadge = (badgeId: string): string => {
  const i = badgeId.indexOf("-");
  return i > 0 ? badgeId.slice(0, i) : "";
};

/** Gememoïseerde set `"${schooljaar}:${leerlingId}:${stroom}"` — welke leerling in welk jaar in welke stroom kleuren heeft. */
let _stroomPresentie: { kleuren: DoelKleuren; set: Set<string> } | null = null;
function stroomPresentie(kleuren: DoelKleuren): Set<string> {
  if (_stroomPresentie?.kleuren === kleuren) return _stroomPresentie.set;
  const set = new Set<string>();
  for (const k of Object.keys(kleuren)) {
    const [sj, sid, ...rest] = k.split(":");
    const stroom = stroomVanBadge(rest.join(":"));
    if (stroom) set.add(`${sj}:${sid}:${stroom}`);
  }
  _stroomPresentie = { kleuren, set };
  return set;
}

/** Gememoïseerde set van bewust gewiste sleutels (die erven geen kleur van vorig jaar). */
let _gewistSet: { arr: string[]; set: Set<string> } | null = null;
function gewistSet(): Set<string> {
  if (_gewistSet?.arr === state.gewist) return _gewistSet.set;
  const set = new Set(state.gewist);
  _gewistSet = { arr: state.gewist, set };
  return set;
}

/** Gememoïseerde `id → leerling`-lookup (was een O(n)-`find` per matrixcel). */
let _studentById: { arr: Student[]; map: Map<string, Student> } | null = null;
function studentById(id: string): Student | undefined {
  if (_studentById?.arr !== state.students) {
    _studentById = { arr: state.students, map: new Map(state.students.map((s) => [s.id, s])) };
  }
  return _studentById.map.get(id);
}

/**
 * De kleur van een badge zoals ze **nu telt** voor een leerling: de eigen kleur van dit
 * schooljaar, of anders de overgenomen kleur uit een vorig schooljaar binnen dezelfde graad.
 * `null` = (nog) niet aangeboden.
 */
export function getDoelKleur(
  kleuren: DoelKleuren,
  schooljaar: string,
  studentId: string,
  nodeId: string,
): Rating | null {
  const eigen = kleuren[doelSleutel(schooljaar, studentId, nodeId)] ?? null;
  if (eigen) return eigen;
  return overgenomenKleur(kleuren, schooljaar, studentId, nodeId);
}

/** Enkel de overgenomen kleur (uit een vorig schooljaar, zelfde graad), zonder de eigen kleur. */
function overgenomenKleur(
  kleuren: DoelKleuren,
  schooljaar: string,
  studentId: string,
  nodeId: string,
): Rating | null {
  const stroom = stroomVanBadge(nodeId);
  if (!stroom) return null;
  if (gewistSet().has(doelSleutel(schooljaar, studentId, nodeId))) return null;
  const student = studentById(studentId);
  // De badge moet bij de graad horen waarin de leerling *dat schooljaar* zat.
  if (!student || stroomVan(student, schooljaar) !== stroom) return null;

  const presentie = stroomPresentie(kleuren);
  for (const sj of eerdereSchooljaren(schooljaar)) {
    if (!presentie.has(`${sj}:${studentId}:${stroom}`)) break; // graadgrens / niet aanwezig
    const kleur = kleuren[doelSleutel(sj, studentId, nodeId)];
    if (kleur) return kleur;
  }
  return null;
}

/** Waar de getoonde kleur vandaan komt: `"eigen"` (dit jaar gezet), `"overgenomen"` (vorig jaar) of `null`. */
export function kleurBron(
  kleuren: DoelKleuren,
  schooljaar: string,
  studentId: string,
  nodeId: string,
): "eigen" | "overgenomen" | null {
  if (kleuren[doelSleutel(schooljaar, studentId, nodeId)]) return "eigen";
  return overgenomenKleur(kleuren, schooljaar, studentId, nodeId) ? "overgenomen" : null;
}

/**
 * Kleur + herkomst in één keer — voor de matrixcellen, zodat `getDoelKleur` en `kleurBron` niet
 * allebei (los) de overname-berekening doen.
 */
export function doelKleurEnBron(
  kleuren: DoelKleuren,
  schooljaar: string,
  studentId: string,
  nodeId: string,
): { kleur: Rating | null; overgenomen: boolean } {
  const eigen = kleuren[doelSleutel(schooljaar, studentId, nodeId)] ?? null;
  if (eigen) return { kleur: eigen, overgenomen: false };
  const over = overgenomenKleur(kleuren, schooljaar, studentId, nodeId);
  return { kleur: over, overgenomen: over !== null };
}

/** Zet dezelfde kleur voor meerdere leerlingen tegelijk op één node (één opslagbeurt). */
export function setDoelKleurBulk(
  schooljaar: string,
  studentIds: string[],
  nodeId: string,
  kleur: Rating | null,
) {
  if (isAfgesloten(schooljaar)) return;
  const kleuren = { ...state.kleuren };
  const logt = kleur !== null && schooljaar === HUIDIG_SCHOOLJAAR;
  const cursusInfo = logt ? cursusInfoVoorNode(nodeId) : null;
  let meldingen = state.meldingen;
  let gewist = state.gewist;
  const wijzigingen: Wijziging[] = [];
  for (const studentId of studentIds) {
    const sleutel = doelSleutel(schooljaar, studentId, nodeId);
    const oud = kleuren[sleutel] ?? null;
    if (oud !== kleur) {
      wijzigingen.push({ sleutel, veld: "kleur", van: oud ?? "", naar: kleur ?? "" });
    }
    if (kleur) kleuren[sleutel] = kleur;
    else delete kleuren[sleutel];
    gewist = pasGewistAan(gewist, sleutel, kleur);
    if (kleur !== null && oud !== kleur && cursusInfo) {
      meldingen = metMelding(meldingen, { studentId, soort: "kleur", ...cursusInfo });
    }
  }
  commit({ ...state, kleuren, auditLog: metAudit(state.auditLog, wijzigingen), meldingen, gewist });
}

// --- Notities ------------------------------------------------------------

export function getNotitie(
  notities: Notities,
  schooljaar: string,
  studentId: string,
  nodeId: string,
): Notitie {
  return notities[notitieSleutel(schooljaar, studentId, nodeId)] ?? LEGE_NOTITIE;
}

/** Werk een notitie bij; verdwijnt als beide velden leeg zijn. */
export function zetNotitie(
  schooljaar: string,
  studentId: string,
  nodeId: string,
  patch: Partial<Notitie>,
) {
  if (isAfgesloten(schooljaar)) return;
  const sleutel = notitieSleutel(schooljaar, studentId, nodeId);
  const huidig = state.notities[sleutel] ?? LEGE_NOTITIE;
  const nieuw: Notitie = {
    zichtbaar: (patch.zichtbaar ?? huidig.zichtbaar).trim(),
    verborgen: (patch.verborgen ?? huidig.verborgen).trim(),
  };
  const gewijzigd =
    huidig.zichtbaar !== nieuw.zichtbaar || huidig.verborgen !== nieuw.verborgen;
  const notities = { ...state.notities };
  if (nieuw.zichtbaar || nieuw.verborgen) notities[sleutel] = nieuw;
  else delete notities[sleutel];
  commit({
    ...state,
    notities,
    auditLog: gewijzigd
      ? metAudit(state.auditLog, [
          {
            sleutel,
            veld: "notitie",
            van: notitieWeergave(huidig),
            naar: notitieWeergave(nieuw),
          },
        ])
      : state.auditLog,
  });
}

/** Wissel het bekeken schooljaar. */
export function setSchooljaar(schooljaar: string) {
  commit({ ...state, schooljaar });
}

/**
 * Sluit een schooljaar af (alleen-lezen) of heropen het. Beheerder-actie (via /gegevens).
 * "Vastzetten in september" = het voorbije schooljaar afsluiten.
 */
export function zetSchooljaarAfgesloten(schooljaar: string, afgesloten: boolean) {
  const huidig = new Set(state.afgeslotenSchooljaren ?? AFGESLOTEN_SCHOOLJAREN);
  if (afgesloten) huidig.add(schooljaar);
  else huidig.delete(schooljaar);
  commit({
    ...state,
    afgeslotenSchooljaren: SCHOOLJAREN.filter((s) => huidig.has(s)),
  });
}

/** Zet de getoonde stromen van de matrix-pagina's (in vaste volgorde, minstens één). */
export function setMatrixStromen(stromen: Stroom[]) {
  const uniek = STROMEN.filter((s) => stromen.includes(s));
  commit({ ...state, matrixStromen: uniek.length > 0 ? uniek : ["1A"] });
}

/** Zet één stroom aan of uit (de laatste actieve stroom blijft staan). */
export function toggleMatrixStroom(stroom: Stroom) {
  const actief = state.matrixStromen.includes(stroom);
  if (actief && state.matrixStromen.length === 1) return;
  setMatrixStromen(
    actief
      ? state.matrixStromen.filter((s) => s !== stroom)
      : [...state.matrixStromen, stroom],
  );
}

/**
 * Cursusfilter voor de matrix-pagina's (Badges / Deelevaluaties / Rubrics), op cursusnaam.
 * `""` = alle cursussen. Gedeeld zodat de keuze meegaat als je van pagina wisselt.
 */
export function setMatrixCursus(cursus: string) {
  commit({ ...state, matrixCursus: cursus });
}

// --- Aanmelden ------------------------------------------------------------

/** Meld aan als een gebruiker (rol + id). Enkel voor deze tab. */
export function meldAan(rol: Basisrol, id: string) {
  commit({ ...state, sessie: { rol, id } });
}

export function meldAf() {
  commit({ ...state, sessie: null });
}

// --- Gebruikers (CSV-import) --------------------------------------------

/**
 * Voeg een ingelezen leerling samen met de bestaande: het huidige leerjaar wordt in de
 * `leerjaarHistoriek` van het **actieve schooljaar** vastgelegd (voor "toen zat die in graad
 * X"), en de historiek van andere jaren blijft behouden.
 */
function samengevoegdeLeerling(bestaand: Student | undefined, nieuw: Student): Student {
  const samen: Student = { ...bestaand, ...nieuw };
  const lj = samen.leerjaar;
  if (typeof lj === "number") {
    samen.leerjaarHistoriek = {
      ...bestaand?.leerjaarHistoriek,
      ...nieuw.leerjaarHistoriek,
      [state.schooljaar]: lj,
    };
  }
  return samen;
}

/**
 * Voeg leerlingen toe of werk ze bij op basis van hun `id`. Bestaande leerlingen die niet in
 * de lijst zitten, blijven staan — zo gaan bij een jaarovergang geen evaluaties verloren.
 */
export function upsertStudenten(nieuwe: Student[]) {
  const perId = new Map(state.students.map((s) => [s.id, s]));
  for (const s of nieuwe) perId.set(s.id, samengevoegdeLeerling(perId.get(s.id), s));
  commit({ ...state, students: [...perId.values()] });
}

/** Vervang de volledige leerlingenlijst (evaluaties van verdwenen id's blijven wel bewaard). */
export function vervangStudenten(nieuwe: Student[]) {
  const oud = new Map(state.students.map((s) => [s.id, s]));
  commit({ ...state, students: nieuwe.map((s) => samengevoegdeLeerling(oud.get(s.id), s)) });
}

/** Voeg leerlingen én mentoren toe/bij op basis van hun `id`. */
export function importeerGebruikers(leerlingen: Student[], mentoren: Mentor[]) {
  const perLl = new Map(state.students.map((s) => [s.id, s]));
  for (const s of leerlingen) perLl.set(s.id, samengevoegdeLeerling(perLl.get(s.id), s));
  const perMe = new Map(state.mentoren.map((m) => [m.id, m]));
  for (const m of mentoren) perMe.set(m.id, { ...perMe.get(m.id), ...m });
  commit({ ...state, students: [...perLl.values()], mentoren: [...perMe.values()] });
}

// --- Eigen groepen ---------------------------------------------------------

/** Maak een nieuwe groep en geef de id terug. Optioneel gekoppeld aan een mentor. */
export function maakGroep(naam: string, leerlingIds: string[], mentorId?: string): string {
  const id = `g${Date.now().toString(36)}`;
  commit({ ...state, groepen: [...state.groepen, { id, naam, leerlingIds, mentorId }] });
  return id;
}

/** Wijzig naam en/of leden van een bestaande groep. */
export function wijzigGroep(id: string, patch: Partial<Omit<Groep, "id">>) {
  commit({
    ...state,
    groepen: state.groepen.map((g) => (g.id === id ? { ...g, ...patch } : g)),
  });
}

/** Verwijder een groep. */
export function verwijderGroep(id: string) {
  commit({ ...state, groepen: state.groepen.filter((g) => g.id !== id) });
}

// --- Minimumdoelen ---------------------------------------------------------

/** Bewaar een bewerking aan één minimumdoel (op basis van zijn unieke code). */
export function wijzigDoel(
  code: string,
  patch: Partial<Omit<Minimumdoel, "code" | "stroom">>,
) {
  commit({
    ...state,
    doelWijzigingen: {
      ...state.doelWijzigingen,
      [code]: { ...state.doelWijzigingen[code], ...patch },
    },
  });
}

/** Zet een via CSV ingeladen doelenlijst (of `null` om terug naar de standaardlijst te gaan). */
export function zetDoelenImport(doelen: Minimumdoel[] | null) {
  commit({ ...state, doelenImport: doelen, doelWijzigingen: {} });
}

// --- Curriculum (badges) database-versie --------------------------------

/**
 * Zet (of wis met `null`) de database-versie van de badges (ruwe vorm: cursussen + badges).
 * Alleen de beheerder roept dit aan (via /gegevens). In firebase-modus wordt het naar de
 * `curriculum/{stroom}/cursussen/…/badges/…`-subboom geschreven; daarna bewerkt de beheerder
 * rechtstreeks in de Firestore-console.
 */
export function zetCurriculumOverride(ruw: CurriculumRuw | null) {
  commit({ ...state, curriculumOverride: ruw });
  void opslag.schrijfCurriculum?.(ruw);
}

/** De ingebouwde (gebundelde) badge-set, ruw — bron voor "zet de huidige badges in de database". */
export const gebundeldCurriculum = (): CurriculumRuw => GEBUNDELD_RUW;

// --- Vestigingen (beheerder) -------------------------------------------

/** De actuele vestigingenlijst — de database-versie, of anders de bundel. */
export const vestigingenLijst = (): Vestiging[] => state.vestigingen ?? GEBUNDELDE_VESTIGINGEN;

/** Hoeveel leerlingen / mentoren / deelbadges hangen aan een vestiging (op naam)? */
export function vestigingInGebruik(naam: string): {
  leerlingen: number;
  mentoren: number;
  deelbadges: number;
} {
  return {
    leerlingen: state.students.filter((s) => s.vestiging === naam).length,
    mentoren: state.mentoren.filter((m) => m.vestiging === naam).length,
    deelbadges: state.deelevaluaties.filter((d) => d.vestiging === naam).length,
  };
}

const bewaarVestigingen = (lijst: Vestiging[]) =>
  commit({ ...state, vestigingen: [...lijst].sort((a, b) => a.volgorde - b.volgorde) });

/** Staat de vestigingenlijst in de opslag (database), of gebruikt de app nog de ingebouwde bundel? */
export const vestigingenUitDatabase = (): boolean => state.vestigingen !== null;

/** Schrijf de huidige (ingebouwde) vestigingenlijst één keer naar de database. */
export function zetVestigingenInDatabase() {
  bewaarVestigingen(vestigingenLijst());
}

/** Voeg een vestiging toe. Geeft `false` terug als de naam al bestaat. */
export function voegVestigingToe(naam: string): boolean {
  const schoon = naam.trim();
  if (!schoon) return false;
  const lijst = vestigingenLijst();
  if (lijst.some((v) => v.naam.toLowerCase() === schoon.toLowerCase())) return false;
  let id = vestigingSlug(schoon);
  while (lijst.some((v) => v.id === id)) id = `${id}-2`;
  bewaarVestigingen([
    ...lijst,
    { id, naam: schoon, actief: true, volgorde: Math.max(-1, ...lijst.map((v) => v.volgorde)) + 1 },
  ]);
  return true;
}

/**
 * Hernoem een vestiging. De id blijft; de naam verandert op het vestiging-doc én — via een
 * cascade — op alle leerlingen/mentoren/deelbadges die die vestiging op naam bewaren.
 * Personeelsaccounts (`gebruikers/`) staan buiten de store; die werkt de /vestigingen-pagina bij.
 */
export function hernoemVestiging(id: string, nieuweNaam: string): boolean {
  const schoon = nieuweNaam.trim();
  const lijst = vestigingenLijst();
  const huidig = lijst.find((v) => v.id === id);
  if (!schoon || !huidig || huidig.naam === schoon) return false;
  if (lijst.some((v) => v.id !== id && v.naam.toLowerCase() === schoon.toLowerCase())) return false;
  const oud = huidig.naam;
  commit({
    ...state,
    vestigingen: lijst.map((v) => (v.id === id ? { ...v, naam: schoon } : v)),
    students: state.students.map((s) => (s.vestiging === oud ? { ...s, vestiging: schoon } : s)),
    mentoren: state.mentoren.map((m) => (m.vestiging === oud ? { ...m, vestiging: schoon } : m)),
    deelevaluaties: state.deelevaluaties.map((d) =>
      d.vestiging === oud ? { ...d, vestiging: schoon } : d,
    ),
  });
  return true;
}

/** Zet een vestiging actief/inactief (inactief = verdwijnt uit keuzelijsten, data blijft). */
export function zetVestigingActief(id: string, actief: boolean) {
  bewaarVestigingen(vestigingenLijst().map((v) => (v.id === id ? { ...v, actief } : v)));
}

/** Verwijder een vestiging — alleen als er geen leerlingen/mentoren/deelbadges aan hangen. */
export function verwijderVestiging(id: string): boolean {
  const v = vestigingenLijst().find((x) => x.id === id);
  if (!v) return false;
  const g = vestigingInGebruik(v.naam);
  if (g.leerlingen + g.mentoren + g.deelbadges > 0) return false;
  bewaarVestigingen(vestigingenLijst().filter((x) => x.id !== id));
  return true;
}

/** Vestigingnamen die in de data voorkomen (leerling/mentor/deelbadge) maar niet in de lijst staan. */
export function ongekoppeldeVestigingen(): string[] {
  const bekend = new Set(vestigingenLijst().map((v) => v.naam));
  const namen = new Set<string>();
  const kijk = (n: string | undefined) => {
    if (n && !bekend.has(n)) namen.add(n);
  };
  for (const s of state.students) kijk(s.vestiging);
  for (const m of state.mentoren) kijk(m.vestiging);
  for (const d of state.deelevaluaties) kijk(d.vestiging);
  return [...namen].sort();
}

// --- Rubrieken -----------------------------------------------------------

/**
 * De actuele rubriekenlijst: de database-versie als die er is, anders de bundel met de losse
 * `rubriekWijzigingen`-patches erover.
 */
export const rubriekenLijst = (): Rubriek[] =>
  state.rubriekenOverride ?? metRubriekWijzigingen(GEBUNDELDE_RUBRIEKEN, state.rubriekWijzigingen);

/** Staat de rubriekenlijst in de database, of gebruikt de app nog de ingebouwde bundel? */
export const rubriekenUitDatabase = (): boolean => state.rubriekenOverride !== null;

/** Is deze rubric afgeweken van de ingebouwde brontekst? */
export function rubriekIsBewerkt(id: string): boolean {
  if (state.rubriekenOverride) {
    const nu = state.rubriekenOverride.find((r) => r.id === id);
    const bron = GEBUNDELDE_RUBRIEKEN.find((r) => r.id === id);
    return !!nu && (!bron || JSON.stringify(nu) !== JSON.stringify(bron));
  }
  return Boolean(state.rubriekWijzigingen[id]);
}

/**
 * Schrijf de huidige rubrieken (bundel + patches) één keer als losse documenten naar de
 * database. Daarna is de database de bron en bewerkt de beheerder de docs zelf.
 */
export function zetRubriekenInDatabase() {
  commit({ ...state, rubriekenOverride: rubriekenLijst(), rubriekWijzigingen: {} });
}

/** Ga terug naar de ingebouwde rubrieken-bundel (wist de database-versie). */
export function wisRubriekenOverride() {
  if (!state.rubriekenOverride) return;
  commit({ ...state, rubriekenOverride: null });
}

/** Bewaar een bewerking aan één uitgeschreven rubric (op basis van zijn id). */
export function wijzigRubriek(id: string, patch: Partial<Omit<Rubriek, "id" | "cursus" | "stroom">>) {
  if (state.rubriekenOverride) {
    commit({
      ...state,
      rubriekenOverride: state.rubriekenOverride.map((r) =>
        r.id === id ? { ...r, ...patch, criteria: { ...r.criteria, ...patch.criteria } } : r,
      ),
    });
    return;
  }
  commit({
    ...state,
    rubriekWijzigingen: {
      ...state.rubriekWijzigingen,
      [id]: { ...state.rubriekWijzigingen[id], ...patch },
    },
  });
}

/** Verwijder alle bewerkingen aan één rubric (terug naar de brontekst). */
export function herstelRubriek(id: string) {
  if (state.rubriekenOverride) {
    const bron = GEBUNDELDE_RUBRIEKEN.find((r) => r.id === id);
    if (!bron) return;
    commit({
      ...state,
      rubriekenOverride: state.rubriekenOverride.map((r) => (r.id === id ? bron : r)),
    });
    return;
  }
  if (!state.rubriekWijzigingen[id]) return;
  const rest = { ...state.rubriekWijzigingen };
  delete rest[id];
  commit({ ...state, rubriekWijzigingen: rest });
}

// --- Deelevaluaties -------------------------------------------------------

/** Maak een deelevaluatie aan en geef de id terug. */
export function maakDeelevaluatie(
  data: Omit<Deelevaluatie, "id">,
): string {
  const nu = Date.now();
  const id = `de${nu.toString(36)}`;
  const wie = huidigeGebruiker();
  commit({
    ...state,
    deelevaluaties: [
      ...state.deelevaluaties,
      { ...data, id, aangemaaktOp: nu, gewijzigdOp: nu, gewijzigdDoor: wie },
    ],
  });
  return id;
}

/** Wijzig een deelevaluatie (het record zelf — titel/datum/badges/toelichting). */
export function wijzigDeelevaluatie(id: string, patch: Partial<Omit<Deelevaluatie, "id">>) {
  const nu = Date.now();
  const wie = huidigeGebruiker();
  commit({
    ...state,
    deelevaluaties: state.deelevaluaties.map((d) =>
      d.id === id ? { ...d, ...patch, gewijzigdOp: nu, gewijzigdDoor: wie } : d,
    ),
  });
}

/** Verwijder een deelevaluatie én de bijhorende kleuren en notities. */
export function verwijderDeelevaluatie(id: string) {
  const deelKleuren = { ...state.deelKleuren };
  const deelNotities = { ...state.deelNotities };
  for (const sleutel of Object.keys(deelKleuren)) {
    if (sleutel.startsWith(`${id}:`)) delete deelKleuren[sleutel];
  }
  for (const sleutel of Object.keys(deelNotities)) {
    if (sleutel.startsWith(`${id}:`)) delete deelNotities[sleutel];
  }
  commit({
    ...state,
    deelevaluaties: state.deelevaluaties.filter((d) => d.id !== id),
    deelKleuren,
    deelNotities,
  });
}

export function getDeelKleur(
  deelKleuren: DeelKleuren,
  deelevaluatieId: string,
  studentId: string,
): Rating | null {
  return deelKleuren[deelSleutel(deelevaluatieId, studentId)] ?? null;
}

/** De notitie bij één deelevaluatiecel (leeg als er geen is). */
export function getDeelNotitie(
  deelNotities: DeelNotities,
  deelevaluatieId: string,
  studentId: string,
): Notitie {
  return deelNotities[deelSleutel(deelevaluatieId, studentId)] ?? LEGE_NOTITIE;
}

/** Werk de notitie bij één deelevaluatiecel bij; verdwijnt als beide velden leeg zijn. */
export function zetDeelNotitie(
  deelevaluatieId: string,
  studentId: string,
  patch: Partial<Notitie>,
) {
  if (deelevaluatieVergrendeld(deelevaluatieId)) return;
  const sleutel = deelSleutel(deelevaluatieId, studentId);
  const huidig = state.deelNotities[sleutel] ?? LEGE_NOTITIE;
  const nieuw: Notitie = {
    zichtbaar: (patch.zichtbaar ?? huidig.zichtbaar).trim(),
    verborgen: (patch.verborgen ?? huidig.verborgen).trim(),
  };
  const gewijzigd =
    huidig.zichtbaar !== nieuw.zichtbaar || huidig.verborgen !== nieuw.verborgen;
  const deelNotities = { ...state.deelNotities };
  if (nieuw.zichtbaar || nieuw.verborgen) deelNotities[sleutel] = nieuw;
  else delete deelNotities[sleutel];
  commit({
    ...state,
    deelNotities,
    auditLog: gewijzigd
      ? metAudit(state.auditLog, [
          {
            sleutel,
            veld: "notitie",
            van: notitieWeergave(huidig),
            naar: notitieWeergave(nieuw),
          },
        ])
      : state.auditLog,
  });
}

const deelevaluatie = (id: string) => state.deelevaluaties.find((d) => d.id === id);
const deelevaluatieVergrendeld = (id: string): boolean => {
  const de = deelevaluatie(id);
  return de ? isAfgesloten(de.schooljaar) : false;
};

/** Melding-info (cursus) voor een deelevaluatie. `null` = niet loggen. */
const deelMeldingInfo = (id: string) => {
  const de = deelevaluatie(id);
  if (!de || de.schooljaar !== HUIDIG_SCHOOLJAAR) return null;
  return {
    soort: "deelevaluatie" as const,
    cursusId: cursusVanLeerdoel(de.leerdoelIds[0] ?? "")?.id ?? "",
    cursusNaam: de.cursus || "je badges",
  };
};

/** Zet (of wis) de kleur van één leerling op een deelevaluatie. */
export function setDeelKleur(
  deelevaluatieId: string,
  studentId: string,
  kleur: Rating | null,
) {
  if (deelevaluatieVergrendeld(deelevaluatieId)) return;
  const deelKleuren = { ...state.deelKleuren };
  const sleutel = deelSleutel(deelevaluatieId, studentId);
  const oud = deelKleuren[sleutel] ?? null;
  const gewijzigd = oud !== kleur;
  const verandert = kleur !== null && oud !== kleur;
  if (kleur) deelKleuren[sleutel] = kleur;
  else delete deelKleuren[sleutel];
  const info = verandert ? deelMeldingInfo(deelevaluatieId) : null;
  const meldingen = info ? metMelding(state.meldingen, { studentId, ...info }) : state.meldingen;
  commit({
    ...state,
    deelKleuren,
    auditLog: gewijzigd
      ? metAudit(state.auditLog, [
          { sleutel, veld: "kleur", van: oud ?? "", naar: kleur ?? "" },
        ])
      : state.auditLog,
    meldingen,
    gewist: pasGewistAan(state.gewist, sleutel, kleur),
  });
}

/** Zet dezelfde kleur voor meerdere leerlingen op een deelevaluatie (één opslagbeurt). */
export function setDeelKleurBulk(
  deelevaluatieId: string,
  studentIds: string[],
  kleur: Rating | null,
) {
  if (deelevaluatieVergrendeld(deelevaluatieId)) return;
  const deelKleuren = { ...state.deelKleuren };
  const info = kleur !== null ? deelMeldingInfo(deelevaluatieId) : null;
  let meldingen = state.meldingen;
  let gewist = state.gewist;
  const wijzigingen: Wijziging[] = [];
  for (const studentId of studentIds) {
    const sleutel = deelSleutel(deelevaluatieId, studentId);
    const oud = deelKleuren[sleutel] ?? null;
    if (oud !== kleur) {
      wijzigingen.push({ sleutel, veld: "kleur", van: oud ?? "", naar: kleur ?? "" });
    }
    if (kleur) deelKleuren[sleutel] = kleur;
    else delete deelKleuren[sleutel];
    gewist = pasGewistAan(gewist, sleutel, kleur);
    if (kleur !== null && oud !== kleur && info) {
      meldingen = metMelding(meldingen, { studentId, ...info });
    }
  }
  commit({
    ...state,
    deelKleuren,
    auditLog: metAudit(state.auditLog, wijzigingen),
    meldingen,
    gewist,
  });
}

/** Wis alle lokale aanpassingen en ga terug naar de seed-data (meldt ook af). */
export function resetStore() {
  commit({ ...seed(), sessie: null });
}
