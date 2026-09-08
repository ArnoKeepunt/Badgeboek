import type { Cursus, DoelCategorie, Leerdoel, Rubric, Stroom } from "./types";
import { badges1A, cursussen1A } from "./curriculum1A";
import { badges1B, cursussen1B } from "./curriculum1B";
import { badges2A, cursussen2A } from "./curriculum2A";
import { badges3A, cursussen3A } from "./curriculum3A";

/**
 * Het badgeboek-curriculum. De **ruwe** vorm (`CurriculumRuw`) is wat de bundel opslaat en wat
 * in Firestore staat: gewoon cursussen + badges. Rubrics (1 onzichtbaar niveau per cursus) en de
 * deelbadge-"types" (badges met dezelfde `groep`) worden door `verrijk()` afgeleid — niet
 * opgeslagen. Zo blijft "Cursus → Badge" de enige echte structuur en volgt de rest automatisch.
 *
 * Auto-gegenereerd (de bundel): `scripts/extract_badges.py` uit
 * `docs/reference/deelevaluaties_alle-graden-2.xlsx`.
 */

export interface CursusRuw {
  id: string;
  stroom: Stroom;
  naam: string;
  volgorde: number;
}

export interface BadgeRuw {
  id: string;
  cursusId: string;
  /** De badge-groep (xlsx-kolom "Deelevaluatie", bv. "Leerwandelingen & uitstappen"). */
  groep: string;
  omschrijving: string;
  volgorde: number;
  categorie: DoelCategorie;
}

export interface CurriculumRuw {
  cursussen: CursusRuw[];
  badges: BadgeRuw[];
}

/** Een deelbadge-"type": badges met dezelfde `groep` binnen een cursus. Afgeleid, niet opgeslagen. */
export interface DeelevaluatieType {
  id: string;
  stroom: Stroom;
  cursus: string;
  naam: string;
  /** Aantal badges in de groep. */
  richtaantal: number;
  leerdoelIds: string[];
}

export interface CurriculumData {
  cursussen: Cursus[];
  rubrics: Rubric[];
  leerdoelen: Leerdoel[];
  deelevaluatieTypes: DeelevaluatieType[];
}

/** De ruwe set → de verrijkte set die de rest van de app gebruikt. */
export function verrijk(ruw: CurriculumRuw): CurriculumData {
  const cursussen: Cursus[] = [...ruw.cursussen]
    .sort((a, b) => a.volgorde - b.volgorde)
    .map((c) => ({ id: c.id, stroom: c.stroom, naam: c.naam }));

  const rubrics: Rubric[] = cursussen.map((c) => ({
    id: `${c.id}-r1`,
    cursusId: c.id,
    naam: c.naam,
  }));

  const badgesGesorteerd = [...ruw.badges].sort((a, b) => a.volgorde - b.volgorde);
  const leerdoelen: Leerdoel[] = badgesGesorteerd.map((b) => ({
    id: b.id,
    rubricId: `${b.cursusId}-r1`,
    omschrijving: b.omschrijving,
    categorie: b.categorie,
  }));

  const cursusById = new Map(cursussen.map((c) => [c.id, c]));
  const perGroep = new Map<string, { cursusId: string; groep: string; ids: string[] }>();
  for (const b of badgesGesorteerd) {
    const sleutel = `${b.cursusId}::${b.groep}`;
    let g = perGroep.get(sleutel);
    if (!g) {
      g = { cursusId: b.cursusId, groep: b.groep, ids: [] };
      perGroep.set(sleutel, g);
    }
    g.ids.push(b.id);
  }
  const deelevaluatieTypes: DeelevaluatieType[] = [];
  for (const [sleutel, g] of perGroep) {
    const c = cursusById.get(g.cursusId);
    if (!c) continue;
    deelevaluatieTypes.push({
      id: sleutel,
      stroom: c.stroom,
      cursus: c.naam,
      naam: g.groep,
      richtaantal: g.ids.length,
      leerdoelIds: g.ids,
    });
  }

  return { cursussen, rubrics, leerdoelen, deelevaluatieTypes };
}

/** De ingebouwde set (uit de bundel), ruw. Ook de bron voor "zet de huidige badges in de database". */
export const GEBUNDELD_RUW: CurriculumRuw = {
  cursussen: [...cursussen1A, ...cursussen1B, ...cursussen2A, ...cursussen3A],
  badges: [...badges1A, ...badges1B, ...badges2A, ...badges3A],
};

export const GEBUNDELD: CurriculumData = verrijk(GEBUNDELD_RUW);

let actief: CurriculumData = GEBUNDELD;

/** Wissel de actieve curriculum-set (ruwe database-versie), of `null` = terug naar de bundel. */
export function zetCurriculum(ruw: CurriculumRuw | null): void {
  actief = ruw ? verrijk(ruw) : GEBUNDELD;
}

/** De actieve (verrijkte) set. */
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
 * leerdoel-id (`1A-planning-en-reflectie` / `…-r1` / `…-d1`).
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
