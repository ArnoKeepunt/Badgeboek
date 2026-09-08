import {
  type DeelevaluatieType,
  alleDeelevaluatieTypes,
  cursussenVoorStroom,
  leerdoelenVoorCursus,
} from "./curriculum";
import type { Deelevaluatie, Leerdoel, Stroom } from "./types";

export type { DeelevaluatieType } from "./curriculum";

/** Alle deelevaluatie-types van één stroom. */
export const typesVoorStroom = (stroom: Stroom): DeelevaluatieType[] =>
  alleDeelevaluatieTypes().filter((t) => t.stroom === stroom);

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
  id ? alleDeelevaluatieTypes().find((t) => t.id === id) : undefined;

/**
 * De deelbadge-types en de badges komen nu uit hetzelfde bestand, dus de cursusnamen zijn
 * gelijk. Deze alias-map blijft als vangnet voor kleine afwijkingen (bv. een oude
 * deelevaluatie met een licht andere cursusnaam).
 */
const CURSUS_ALIAS: Record<string, string> = {};

const norm = (s: string) => s.trim().toLowerCase();

/**
 * De kapstok-cursusnaam (zoals in `cursusNamenVoorStroom`) die bij een badge-cursus hoort. De
 * namen zijn nu gelijk (zelfde bronbestand), dus dit is meestal een 1-op-1 match; valt terug
 * op de badge-naam zelf als er geen kapstok-tegenhanger is.
 */
export function kapstokCursusVoorBadgeCursus(stroom: Stroom, badgeCursus: string): string {
  const doel = CURSUS_ALIAS[norm(badgeCursus)] ?? norm(badgeCursus);
  const match = cursusNamenVoorStroom(stroom).find((k) => {
    const n = CURSUS_ALIAS[norm(k)] ?? norm(k);
    return n === doel || n.startsWith(doel) || doel.startsWith(n);
  });
  return match ?? badgeCursus;
}

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

/** Sorteervolgorde: op datum (leeg laatst), dan op titel. */
const opDatumDanTitel = (a: Deelevaluatie, b: Deelevaluatie): number => {
  if (a.datum && b.datum && a.datum !== b.datum) return a.datum < b.datum ? -1 : 1;
  if (Boolean(a.datum) !== Boolean(b.datum)) return a.datum ? -1 : 1;
  return a.titel.localeCompare(b.titel, "nl");
};

/** Deelevaluaties van een stroom + schooljaar, op datum en titel. */
export function deelevaluatiesVoor(
  alle: Deelevaluatie[],
  stroom: Stroom,
  schooljaar: string,
): Deelevaluatie[] {
  return alle
    .filter((d) => d.stroom === stroom && d.schooljaar === schooljaar)
    .sort(opDatumDanTitel);
}

/**
 * De deelevaluaties die aan één badge (leerdoel) gekoppeld zijn, in een schooljaar. Optioneel
 * ook filteren op cursus (via dezelfde alias-logica als `koppelbareBadges`): dan verdwijnen
 * deelevaluaties van een ander vak. De `schooljaar`-filter is nodig omdat de `deelKleuren`-
 * sleutels zelf geen schooljaar bevatten.
 */
export function deelevaluatiesVoorBadge(
  alle: Deelevaluatie[],
  leerdoelId: string,
  schooljaar: string,
  cursusFilter?: string,
): Deelevaluatie[] {
  const doel = cursusFilter ? (CURSUS_ALIAS[norm(cursusFilter)] ?? norm(cursusFilter)) : "";
  return alle
    .filter((d) => d.schooljaar === schooljaar && d.leerdoelIds.includes(leerdoelId))
    .filter((d) => {
      if (!doel) return true;
      const n = norm(d.cursus);
      return n === doel || n.startsWith(doel) || doel.startsWith(n);
    })
    .sort(opDatumDanTitel);
}
