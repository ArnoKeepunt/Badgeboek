import { cursussenVoorStroom, leerdoelenVoorCursus } from "./curriculum";
import { type DeelevaluatieType, deelevaluatieTypes } from "./deelevaluatieTypes";
import type { Deelevaluatie, Leerdoel, Stroom } from "./types";

export type { DeelevaluatieType } from "./deelevaluatieTypes";

/** Alle deelevaluatie-types van één stroom. */
export const typesVoorStroom = (stroom: Stroom): DeelevaluatieType[] =>
  deelevaluatieTypes.filter((t) => t.stroom === stroom);

/** De cursussen (namen) die in de deelevaluatie-kapstok van een stroom voorkomen, op volgorde. */
export function cursusNamenVoorStroom(stroom: Stroom): string[] {
  const gezien = new Set<string>();
  const uit: string[] = [];
  for (const t of typesVoorStroom(stroom)) {
    if (!gezien.has(t.cursus)) {
      gezien.add(t.cursus);
      uit.push(t.cursus);
    }
  }
  return uit;
}

export const typesVoorCursus = (stroom: Stroom, cursus: string): DeelevaluatieType[] =>
  typesVoorStroom(stroom).filter((t) => t.cursus === cursus);

export const typeById = (id: string | null | undefined): DeelevaluatieType | undefined =>
  id ? deelevaluatieTypes.find((t) => t.id === id) : undefined;

/**
 * De naam van de deelevaluatie-cursus verschilt soms licht van de badge-cursus
 * ("Actuaronde" ↔ "Actua"). Deze alias helpt om de juiste badges voor te stellen.
 */
const CURSUS_ALIAS: Record<string, string> = {
  actuaronde: "actua",
  "vrije tekst": "vrije tekst",
  "focusateliers & vrije ateliers": "ateliers",
  basisfreinetvaardigheden: "basisvaardigheden",
};

const norm = (s: string) => s.trim().toLowerCase();

/**
 * De badges (leerdoelen) die een leerkracht kan koppelen, gegroepeerd per badge-cursus.
 * De cursus die bij de deelevaluatie hoort staat vooraan.
 */
export function koppelbareBadges(
  stroom: Stroom,
  deelCursus?: string,
): { cursusId: string; cursusNaam: string; leerdoelen: Leerdoel[]; voorgesteld: boolean }[] {
  const doel = deelCursus ? (CURSUS_ALIAS[norm(deelCursus)] ?? norm(deelCursus)) : "";
  const rijen = cursussenVoorStroom(stroom).map((c) => {
    const n = norm(c.naam);
    const voorgesteld = Boolean(doel) && (n === doel || n.startsWith(doel) || doel.startsWith(n));
    return {
      cursusId: c.id,
      cursusNaam: c.naam,
      leerdoelen: leerdoelenVoorCursus(c.id),
      voorgesteld,
    };
  });
  return rijen.sort((a, b) => Number(b.voorgesteld) - Number(a.voorgesteld));
}

/** Deelevaluaties van een stroom + schooljaar, op datum (leeg laatst) en titel. */
export function deelevaluatiesVoor(
  alle: Deelevaluatie[],
  stroom: Stroom,
  schooljaar: string,
): Deelevaluatie[] {
  return alle
    .filter((d) => d.stroom === stroom && d.schooljaar === schooljaar)
    .sort((a, b) => {
      if (a.datum && b.datum && a.datum !== b.datum) return a.datum < b.datum ? -1 : 1;
      if (Boolean(a.datum) !== Boolean(b.datum)) return a.datum ? -1 : 1;
      return a.titel.localeCompare(b.titel, "nl");
    });
}
