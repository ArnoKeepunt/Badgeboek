import { GRAAD_LABEL, graadVan, unieke } from "./leerlingen";
import type { Groep, Student } from "./types";

/**
 * Groepen komen in twee smaken:
 * - **eigen**: door een mentor gemaakt (naam + gekozen leerlingen), bewaard in de store.
 * - **systeem**: automatisch afgeleid uit de leerlinggegevens (per graad, leerjaar,
 *   vestiging of klasgroep). Deze kan je niet bewerken, wel gebruiken als filter.
 */

export type GroepSoort =
  | "eigen"
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
}

export const SOORT_LABEL: Record<GroepSoort, string> = {
  eigen: "Mijn groepen",
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
  for (const v of unieke(students.map((s) => s.vestiging))) {
    defs.push({
      id: `vestiging:${v}`,
      naam: v,
      soort: "vestiging",
      leerlingIds: students.filter((s) => s.vestiging === v).map((s) => s.id),
    });
  }
  for (const k of unieke(students.map((s) => s.klasgroep))) {
    defs.push({
      id: `klasgroep:${k}`,
      naam: `Groep ${k}`,
      soort: "klasgroep",
      leerlingIds: students.filter((s) => s.klasgroep === k).map((s) => s.id),
    });
  }

  const vestigingen = unieke(students.map((s) => s.vestiging)).sort((a, b) => a.localeCompare(b));
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
  return defs;
}

export const eigenGroepDefs = (groepen: Groep[]): GroepDef[] =>
  groepen.map((g) => ({
    id: `eigen:${g.id}`,
    naam: g.naam,
    soort: "eigen",
    leerlingIds: g.leerlingIds,
  }));

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
