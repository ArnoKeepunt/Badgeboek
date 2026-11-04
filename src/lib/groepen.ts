import { GRAAD_LABEL, graadVan, stroomVan, unieke } from "./leerlingen";
import type { Groep, Stroom, Student } from "./types";

/**
 * Groepen komen in twee smaken:
 * - **eigen**: door een mentor gemaakt (naam + gekozen leerlingen), bewaard in de store.
 * - **systeem**: automatisch afgeleid uit de leerlinggegevens (per graad, leerjaar,
 *   vestiging of klasgroep). Deze kan je niet bewerken, wel gebruiken als filter.
 */

export type GroepSoort =
  | "eigen"
  | "collega"
  | "graad"
  | "leerjaar"
  | "vestiging"
  | "klasgroep"
  | "graad-vestiging"
  | "leerjaar-vestiging";

export interface GroepDef {
  /** Stabiele id, bv. "eigen:g123", "graad:2", "vestiging:Gent". */
  id: string;
  naam: string;
  soort: GroepSoort;
  leerlingIds: string[];
  /** Enkel bij `soort: "eigen"`: wie de groep beheren (maker + mee-mentoren, zie `groepEigenaars`). */
  eigenaars?: string[];
}

export const SOORT_LABEL: Record<GroepSoort, string> = {
  eigen: "Mijn groepen",
  collega: "Groepen van collega's",
  graad: "Per graad",
  leerjaar: "Per leerjaar",
  vestiging: "Per vestiging",
  klasgroep: "Per klasgroep",
  "graad-vestiging": "Graad per vestiging",
  "leerjaar-vestiging": "Leerjaar per vestiging",
};

/** Volgorde waarin de systeemcategorieën getoond worden. */
export const SYSTEEM_SOORTEN: GroepSoort[] = [
  "graad",
  "leerjaar",
  "vestiging",
  "klasgroep",
  "graad-vestiging",
  "leerjaar-vestiging",
];

export function systeemGroepen(students: Student[]): GroepDef[] {
  const defs: GroepDef[] = [];

  for (const g of unieke(students.map((s) => graadVan(s.leerjaar)))) {
    defs.push({
      id: `graad:${g}`,
      naam: GRAAD_LABEL[g] ?? `${g}e graad`,
      soort: "graad",
      leerlingIds: students.filter((s) => graadVan(s.leerjaar) === g).map((s) => s.id),
    });
  }
  for (const j of unieke(students.map((s) => s.leerjaar))) {
    defs.push({
      id: `leerjaar:${j}`,
      naam: `${j}e jaar`,
      soort: "leerjaar",
      leerlingIds: students.filter((s) => s.leerjaar === j).map((s) => s.id),
    });
  }
  // Zit alles binnen één vestiging (bv. een mentor met een vestiging-scope), dan zijn de
  // vestiging-categorieën ("Per vestiging", "Graad per vestiging", "Leerjaar per vestiging")
  // overbodig — ze zeggen dan hetzelfde als "Per graad" / "Per leerjaar".
  const vestigingSet = unieke(students.map((s) => s.vestiging));
  const meerdereVestigingen = vestigingSet.length > 1;

  if (meerdereVestigingen) {
    for (const v of vestigingSet) {
      defs.push({
        id: `vestiging:${v}`,
        naam: v,
        soort: "vestiging",
        leerlingIds: students.filter((s) => s.vestiging === v).map((s) => s.id),
      });
    }
  }
  for (const k of unieke(students.map((s) => s.klasgroep))) {
    defs.push({
      id: `klasgroep:${k}`,
      naam: `Groep ${k}`,
      soort: "klasgroep",
      leerlingIds: students.filter((s) => s.klasgroep === k).map((s) => s.id),
    });
  }

  if (meerdereVestigingen) {
    const vestigingen = [...vestigingSet].sort((a, b) => a.localeCompare(b));
    const graden = unieke(students.map((s) => graadVan(s.leerjaar))).sort((a, b) => a - b);
    const leerjaren = unieke(students.map((s) => s.leerjaar)).sort((a, b) => a - b);

    for (const v of vestigingen) {
      for (const g of graden) {
        const ids = students
          .filter((s) => s.vestiging === v && graadVan(s.leerjaar) === g)
          .map((s) => s.id);
        if (ids.length === 0) continue;
        defs.push({
          id: `graad-vestiging:${g}:${v}`,
          naam: `${GRAAD_LABEL[g] ?? `${g}e graad`} · ${v}`,
          soort: "graad-vestiging",
          leerlingIds: ids,
        });
      }
    }
    for (const v of vestigingen) {
      for (const j of leerjaren) {
        const ids = students.filter((s) => s.vestiging === v && s.leerjaar === j).map((s) => s.id);
        if (ids.length === 0) continue;
        defs.push({
          id: `leerjaar-vestiging:${j}:${v}`,
          naam: `${j}e jaar · ${v}`,
          soort: "leerjaar-vestiging",
          leerlingIds: ids,
        });
      }
    }
  }
  return defs;
}

export const eigenGroepDefs = (groepen: Groep[]): GroepDef[] =>
  groepen.map((g) => ({
    id: `eigen:${g.id}`,
    naam: g.naam,
    soort: "eigen",
    leerlingIds: g.leerlingIds,
    eigenaars: groepEigenaars(g),
  }));

/** Wie een zelfgemaakte groep beheren: de maker (`mentorId`) + de mee-mentoren (`mentorIds`). */
export const groepEigenaars = (g: Pick<Groep, "mentorId" | "mentorIds">): string[] => [
  ...new Set([...(g.mentorId ? [g.mentorId] : []), ...(g.mentorIds ?? [])]),
];

/** Is dit (ook) een groep van `actorId`? Zonder `actorId` nooit. */
export const isGroepVan = (
  g: Pick<Groep, "mentorId" | "mentorIds">,
  actorId: string | undefined,
): boolean => actorId !== undefined && groepEigenaars(g).includes(actorId);

/**
 * Voor de keuzelijsten: de zelfgemaakte groepen splitsen in "Mijn groepen" (gemaakt of mee
 * beheerd door `actorId`) en "Groepen van collega's" (de rest: van collega's of zonder eigenaar), zodat je
 * eigen groepen bovenaan staan en niet verdrinken in die van anderen. Welke groepen er überhaupt
 * in komen (eigen vestiging, geen privégroepen van anderen) bepaalt `useZichtbareGroepen`.
 * Zonder `actorId` (local-modus, geen account) blijft alles onder "Mijn groepen". De id blijft
 * dezelfde (`eigen:…`), enkel de rubriek in de keuzelijst verschilt.
 */
export const splitsEigenGroepen = (defs: GroepDef[], actorId: string | undefined): GroepDef[] =>
  actorId
    ? defs.map((d) =>
        d.soort === "eigen" && !d.eigenaars?.includes(actorId)
          ? { ...d, soort: "collega" as const }
          : d,
      )
    : defs;

export const alleGroepDefs = (students: Student[], groepen: Groep[]): GroepDef[] => [
  ...eigenGroepDefs(groepen),
  ...systeemGroepen(students),
];

/** Ledenset voor een geselecteerde groep-id, of null als er geen (geldige) groep is. */
export function groepLeden(
  groepId: string,
  students: Student[],
  groepen: Groep[],
): Set<string> | null {
  if (!groepId) return null;
  const def = alleGroepDefs(students, groepen).find((d) => d.id === groepId);
  return def ? new Set(def.leerlingIds) : null;
}

/**
 * De stromen (badgeboeken) waarin de leden van een groep zitten, bv. `["1A", "1B"]` voor een
 * groep die een hele graad omvat. Gebruikt om de stroomkeuze automatisch mee te laten
 * opschuiven met een gekozen groep — anders kan de stroomfilter een andere graad tonen dan
 * waar de groep zijn leerlingen in zitten, en toont de matrix niemand.
 */
export function stromenVanGroep(groepId: string, students: Student[], groepen: Groep[]): Stroom[] {
  const leden = groepLeden(groepId, students, groepen);
  if (!leden) return [];
  return [...new Set(students.filter((s) => leden.has(s.id)).map((s) => stroomVan(s)))];
}
