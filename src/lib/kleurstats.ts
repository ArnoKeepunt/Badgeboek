import { RATINGS, STATUSSEN } from "./ratings";
import type { Rating } from "./types";

export type KleurTelling = Record<Rating, number> & { leeg: number };

const LEEG: KleurTelling = {
  blue: 0,
  green: 0,
  yellow: 0,
  red: 0,
  afwezig: 0,
  vrijgesteld: 0,
  nvt: 0,
  leeg: 0,
};

/** Tel de kleuren, statussen en lege van een lijst waarden. */
export function telKleuren(waarden: (Rating | null)[]): KleurTelling {
  const t: KleurTelling = { ...LEEG };
  for (const w of waarden) {
    if (w === null) t.leeg += 1;
    else t[w] += 1;
  }
  return t;
}

/** Aantal met een **kleur** (niet leeg, niet een witte status). */
export const aantalIngevuld = (t: KleurTelling): number =>
  RATINGS.reduce((sum, r) => sum + t[r], 0);

/** Gewettigd afwezig / vrijgesteld / n.v.t. — vallen buiten de noemer. */
export const aantalBuitenBeschouwing = (t: KleurTelling): number =>
  STATUSSEN.reduce((sum, r) => sum + t[r], 0);

/**
 * Aantal **behaald**: enkel groen of blauw telt mee. Geel/rood = wel al beoordeeld, maar nog
 * niet behaald; leeg = nog niet aangeboden; witte status = niet van toepassing.
 */
export const aantalBehaald = (t: KleurTelling): number => t.green + t.blue;
