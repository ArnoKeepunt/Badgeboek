import type { Cursus, Leerdoel, Rubric, Stroom } from "./types";
import { cursussen1A, leerdoelen1A, rubrics1A } from "./curriculum1A";
import { cursussen1B, leerdoelen1B, rubrics1B } from "./curriculum1B";
import { cursussen2A, leerdoelen2A, rubrics2A } from "./curriculum2A";
import { cursussen3A, leerdoelen3A, rubrics3A } from "./curriculum3A";
import { type DeelevaluatieType, deelevaluatieTypes } from "./deelevaluatieTypes";

/**
 * Het badgeboek-curriculum: Cursus → Leerdoel (= badge), per graad/stroom. Er is precies één
 * (verborgen) Rubric per cursus — de badges staan plat onder de cursus. De **gebundelde** set
 * (`GEBUNDELD`) is auto-gegenereerd via `scripts/extract_badges.py` uit
 * `docs/reference/deelevaluaties_alle-graden-2.xlsx` (dezelfde bron als de deelbadge-kapstok).
 *
 * De gebundelde set is de onmiddellijke, offline terugval. Staat er een database-versie klaar
 * (`curriculum/actief` in Firestore, alleen door de beheerder bewerkbaar), dan **vervangt** die
 * de bundel volledig — de store roept dan `zetCurriculum(...)` aan. Alle helpers hieronder
 * lezen de *actieve* set, dus de rest van de app merkt er niets van.
 */

export interface CurriculumData {
  cursussen: Cursus[];
  rubrics: Rubric[];
  leerdoelen: Leerdoel[];
  deelevaluatieTypes: DeelevaluatieType[];
}

/** De ingebouwde set (uit de bundel). Ook de bron voor "zet de huidige badges in de database". */
export const GEBUNDELD: CurriculumData = {
  cursussen: [...cursussen1A, ...cursussen1B, ...cursussen2A, ...cursussen3A],
  rubrics: [...rubrics1A, ...rubrics1B, ...rubrics2A, ...rubrics3A],
  leerdoelen: [...leerdoelen1A, ...leerdoelen1B, ...leerdoelen2A, ...leerdoelen3A],
  deelevaluatieTypes,
};

let actief: CurriculumData = GEBUNDELD;

/** Wissel de actieve curriculum-set. `null` = terug naar de gebundelde set. */
export function zetCurriculum(data: CurriculumData | null): void {
  actief = data ?? GEBUNDELD;
}

/** De actieve set (database-versie of bundel). */
export const actiefCurriculum = (): CurriculumData => actief;

// --- Ruwe lijsten (actieve set) --------------------------------------------

export const alleCursussen = (): Cursus[] => actief.cursussen;
export const alleRubrics = (): Rubric[] => actief.rubrics;
export const alleLeerdoelen = (): Leerdoel[] => actief.leerdoelen;
export const alleDeelevaluatieTypes = (): DeelevaluatieType[] => actief.deelevaluatieTypes;

// --- Afgeleide helpers -----------------------------------------------------

export const cursussenVoorStroom = (stroom: Stroom): Cursus[] =>
  actief.cursussen.filter((c) => c.stroom === stroom);

export const rubricsVoorCursus = (cursusId: string): Rubric[] =>
  actief.rubrics.filter((r) => r.cursusId === cursusId);

/** De cursus waartoe een leerdoel (badge) behoort. */
export function cursusVanLeerdoel(leerdoelId: string): Cursus | undefined {
  const l = actief.leerdoelen.find((x) => x.id === leerdoelId);
  if (!l) return undefined;
  const r = actief.rubrics.find((x) => x.id === l.rubricId);
  return r ? actief.cursussen.find((c) => c.id === r.cursusId) : undefined;
}

/**
 * De cursus waartoe een node behoort. Een node-id is een cursus-id, een rubric-id of een
 * leerdoel-id. De id's zijn structureel ondubbelzinnig (`1A-c1` / `1A-c1-r1` / `1A-c1-r1-d1`),
 * dus de volgorde van de lookups kan niet mismatchen.
 */
export function cursusVanNode(nodeId: string): Cursus | undefined {
  const cursus = actief.cursussen.find((c) => c.id === nodeId);
  if (cursus) return cursus;
  const rubric = actief.rubrics.find((r) => r.id === nodeId);
  if (rubric) return actief.cursussen.find((c) => c.id === rubric.cursusId);
  return cursusVanLeerdoel(nodeId);
}

export const leerdoelenVoorRubric = (rubricId: string): Leerdoel[] =>
  actief.leerdoelen.filter((l) => l.rubricId === rubricId);

export const leerdoelenVoorCursus = (cursusId: string): Leerdoel[] => {
  const rubricIds = new Set(rubricsVoorCursus(cursusId).map((r) => r.id));
  return actief.leerdoelen.filter((l) => rubricIds.has(l.rubricId));
};

export const leerdoelenVoorStroom = (stroom: Stroom): Leerdoel[] => {
  const cursusIds = new Set(cursussenVoorStroom(stroom).map((c) => c.id));
  const rubricIds = new Set(
    actief.rubrics.filter((r) => cursusIds.has(r.cursusId)).map((r) => r.id),
  );
  return actief.leerdoelen.filter((l) => rubricIds.has(l.rubricId));
};
