import type { Cursus, Leerdoel, Rubric, Stroom } from "./types";
import { cursussen1A, leerdoelen1A, rubrics1A } from "./curriculum1A";
import { cursussen1B, leerdoelen1B, rubrics1B } from "./curriculum1B";
import { cursussen2A, leerdoelen2A, rubrics2A } from "./curriculum2A";
import { cursussen3A, leerdoelen3A, rubrics3A } from "./curriculum3A";

/**
 * Het badgeboek-curriculum: Cursus → Leerdoel (= badge), per graad/stroom. Er is precies één
 * (verborgen) Rubric per cursus — de badges staan plat onder de cursus. Auto-gegenereerd via
 * `scripts/extract_badges.py` uit `docs/reference/deelevaluaties_alle-graden-2.xlsx`, dezelfde
 * bron als `deelevaluatieTypes.ts`.
 */

export const cursussen: Cursus[] = [
  ...cursussen1A,
  ...cursussen1B,
  ...cursussen2A,
  ...cursussen3A,
];

export const rubrics: Rubric[] = [...rubrics1A, ...rubrics1B, ...rubrics2A, ...rubrics3A];

export const leerdoelen: Leerdoel[] = [
  ...leerdoelen1A,
  ...leerdoelen1B,
  ...leerdoelen2A,
  ...leerdoelen3A,
];

// --- Afgeleide helpers -------------------------------------------------------

export const cursussenVoorStroom = (stroom: Stroom): Cursus[] =>
  cursussen.filter((c) => c.stroom === stroom);

export const rubricsVoorCursus = (cursusId: string): Rubric[] =>
  rubrics.filter((r) => r.cursusId === cursusId);

/** De cursus waartoe een leerdoel (badge) behoort. */
export function cursusVanLeerdoel(leerdoelId: string): Cursus | undefined {
  const l = leerdoelen.find((x) => x.id === leerdoelId);
  if (!l) return undefined;
  const r = rubrics.find((x) => x.id === l.rubricId);
  return r ? cursussen.find((c) => c.id === r.cursusId) : undefined;
}

/**
 * De cursus waartoe een node behoort. Een node-id is een cursus-id, een rubric-id of een
 * leerdoel-id. De id's zijn structureel ondubbelzinnig (`1A-c1` / `1A-c1-r1` / `1A-c1-r1-d1`),
 * dus de volgorde van de lookups kan niet mismatchen.
 */
export function cursusVanNode(nodeId: string): Cursus | undefined {
  const basis = nodeId;
  const cursus = cursussen.find((c) => c.id === basis);
  if (cursus) return cursus;
  const rubric = rubrics.find((r) => r.id === basis);
  if (rubric) return cursussen.find((c) => c.id === rubric.cursusId);
  return cursusVanLeerdoel(basis);
}

export const leerdoelenVoorRubric = (rubricId: string): Leerdoel[] =>
  leerdoelen.filter((l) => l.rubricId === rubricId);

export const leerdoelenVoorCursus = (cursusId: string): Leerdoel[] => {
  const rubricIds = new Set(rubricsVoorCursus(cursusId).map((r) => r.id));
  return leerdoelen.filter((l) => rubricIds.has(l.rubricId));
};

export const leerdoelenVoorStroom = (stroom: Stroom): Leerdoel[] => {
  const cursusIds = new Set(cursussenVoorStroom(stroom).map((c) => c.id));
  const rubricIds = new Set(rubrics.filter((r) => cursusIds.has(r.cursusId)).map((r) => r.id));
  return leerdoelen.filter((l) => rubricIds.has(l.rubricId));
};
