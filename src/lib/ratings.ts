import type { Rating } from "./types";

/**
 * Vaste weergavevolgorde van de kleuren. Dit is enkel een conventie voor de volgorde
 * in de UI (balken, menu's) — Keerpunt koppelt er geen "geslaagd/gefaald" aan.
 */
export const RATINGS: Rating[] = ["red", "yellow", "green", "blue"];

export const RATING_LABEL: Record<Rating, string> = {
  red: "Rood",
  yellow: "Geel",
  green: "Groen",
  blue: "Blauw",
};

export const RATING_MEANING: Record<Rating, string> = {
  red: "Rood",
  yellow: "Geel",
  green: "Groen",
  blue: "Blauw",
};

/** Getoond voor de lege / `null`-staat. */
export const RATING_EMPTY_LABEL = "Niet aangeboden";
export const RATING_EMPTY_MEANING = "Nog niet aangeboden of geëvalueerd";

/** Index in RATINGS — enkel voor een consistente sorteervolgorde, geen score. */
export const ratingRank = (r: Rating): number => RATINGS.indexOf(r);
