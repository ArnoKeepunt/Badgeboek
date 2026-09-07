import { RATINGS } from "./ratings";
import type { Rating } from "./types";

export type KleurTelling = Record<Rating, number> & { leeg: number };

/** Tel de kleuren (en lege) van een lijst waarden. */
export function telKleuren(waarden: (Rating | null)[]): KleurTelling {
  const t: KleurTelling = { red: 0, yellow: 0, green: 0, blue: 0, leeg: 0 };
  for (const w of waarden) {
    if (w === null) t.leeg += 1;
    else t[w] += 1;
  }
  return t;
}

/** Aantal ingevulde (niet-lege) waarden in een telling. */
export const aantalIngevuld = (t: KleurTelling): number =>
  RATINGS.reduce((sum, r) => sum + t[r], 0);

/**
 * Aantal **behaald**: enkel groen of blauw telt mee. Geel/rood = wel al beoordeeld, maar nog
 * niet behaald; leeg = nog niet aangeboden.
 */
export const aantalBehaald = (t: KleurTelling): number => t.green + t.blue;
