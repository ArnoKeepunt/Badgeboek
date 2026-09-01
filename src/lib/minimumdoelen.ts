import type { Rating } from "./types";
import { minimumdoelen1A } from "./minimumdoelen1A";

/**
 * De minimumdoelen / eindtermen (los van de badges). Voorlopig een vaste, ingekeken lijst;
 * de bedoeling is dat deze later ook aangepast kan worden. Bron: het decretale
 * eindtermenbestand voor de eerste graad A (zie docs/reference/doelen1GRA_volledig.xlsx).
 */

export type DoelSoort = "standaard" | "basisgeletterdheid" | "uitbreiding" | "freinet";

export interface Minimumdoel {
  /** Unieke code, bv. "1A.ST.01.01". */
  code: string;
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

export const minimumdoelen: Minimumdoel[] = minimumdoelen1A;

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

export function competenties(lijst: Minimumdoel[] = minimumdoelen): Competentie[] {
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
