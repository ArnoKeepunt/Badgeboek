import type { Rating, Stroom } from "./types";
import { minimumdoelen1A } from "./minimumdoelen1A";
import { minimumdoelen1B } from "./minimumdoelen1B";
import { minimumdoelen2A } from "./minimumdoelen2A";

/**
 * De minimumdoelen / eindtermen (los van de badges). Bron: de decretale eindtermenbestanden
 * per graad/stroom (zie docs/reference/doelen*_volledig.xlsx). Dit is de basislijst; de app
 * bewaart bewerkingen apart (doelWijzigingen in de store) en legt die er bovenop.
 * 3e graad (3A) is nog niet aangeleverd.
 */

export { STROMEN, STROOM_LABEL } from "./types";
export type { Stroom } from "./types";

export type DoelSoort = "standaard" | "basisgeletterdheid" | "uitbreiding" | "freinet";

export interface Minimumdoel {
  /** Unieke code, bv. "1A.ST.01.01". */
  code: string;
  stroom: Stroom;
  competentieNr: number;
  /** Volledige naam van de sleutelcompetentie. */
  competentie: string;
  /** Nummer binnen de competentie, bv. "01.01" of "BG02.01". */
  nummer: string;
  soort: DoelSoort;
  omschrijving: string;
  uitleg: string;
  opmerking?: string;
}

/** De volledige basislijst over alle aangeleverde stromen (1A + 1B + 2A). */
export const alleMinimumdoelen: Minimumdoel[] = [
  ...minimumdoelen1A,
  ...minimumdoelen1B,
  ...minimumdoelen2A,
];

/** Een doelenlijst met de opgeslagen per-doel-bewerkingen erover gelegd. */
export function metWijzigingen(
  basis: Minimumdoel[],
  wijzigingen: Record<string, Partial<Minimumdoel>>,
): Minimumdoel[] {
  return basis.map((d) => {
    const patch = wijzigingen[d.code];
    return patch ? { ...d, ...patch } : d;
  });
}

export const SOORT_LABEL: Record<DoelSoort, string> = {
  standaard: "Standaard",
  basisgeletterdheid: "Basisgeletterdheid",
  uitbreiding: "Uitbreiding",
  freinet: "Freinet",
};

/**
 * Kleurcode per soort — dezelfde vier kleuren als de badge-evaluatie.
 * Eén plek om aan te passen als de toewijzing anders moet.
 */
export const SOORT_KLEUR: Record<DoelSoort, Rating> = {
  basisgeletterdheid: "red",
  standaard: "green",
  uitbreiding: "blue",
  freinet: "yellow",
};

/** Sleutelcompetenties in de volgorde waarin ze voorkomen. */
export interface Competentie {
  nr: number;
  naam: string;
  doelen: Minimumdoel[];
}

export function competenties(lijst: Minimumdoel[]): Competentie[] {
  const kaart = new Map<number, Competentie>();
  for (const d of lijst) {
    let c = kaart.get(d.competentieNr);
    if (!c) {
      c = { nr: d.competentieNr, naam: d.competentie, doelen: [] };
      kaart.set(d.competentieNr, c);
    }
    c.doelen.push(d);
  }
  return [...kaart.values()].sort((a, b) => a.nr - b.nr);
}

/** "1. Competenties in het Nederlands" → "Competenties in het Nederlands". */
export const competentieKort = (naam: string): string =>
  naam.replace(/^\s*\d+\.\s*/, "");
