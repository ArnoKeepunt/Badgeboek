import type { Rating } from "./types";

/**
 * Weergavevolgorde van de vier kleuren — **positiefste eerst** (menu's, balken). Keerpunt
 * koppelt er geen "geslaagd/gefaald" aan; dit is enkel een conventie voor de volgorde.
 */
export const RATINGS: Rating[] = ["blue", "green", "yellow", "red"];

/**
 * De witte statussen: geen kleur. Tellen niet mee als "behaald" en vallen buiten de noemer
 * van de voortgangstellers (n.v.t. = de badge is niet van toepassing op deze leerling).
 */
export const STATUSSEN: Rating[] = ["afwezig", "vrijgesteld", "nvt"];

export const isStatus = (r: Rating): boolean => (STATUSSEN as string[]).includes(r);

export const RATING_LABEL: Record<Rating, string> = {
  blue: "Blauw",
  green: "Groen",
  yellow: "Geel",
  red: "Rood",
  afwezig: "Gewettigd afwezig",
  vrijgesteld: "Vrijgesteld",
  nvt: "N.v.t.",
};

/** Korte weergave voor een cel-knop (weinig plaats). */
export const RATING_KORT: Record<Rating, string> = {
  blue: "Blauw",
  green: "Groen",
  yellow: "Geel",
  red: "Rood",
  afwezig: "Afw.",
  vrijgesteld: "Vrijg.",
  nvt: "n.v.t.",
};

export const RATING_MEANING: Record<Rating, string> = {
  blue: "Blauw",
  green: "Groen",
  yellow: "Geel",
  red: "Rood",
  afwezig: "Gewettigd afwezig — telt niet mee",
  vrijgesteld: "Vrijgesteld — telt niet mee",
  nvt: "Niet van toepassing — telt niet mee",
};

/** Getoond voor de lege / `null`-staat. */
export const RATING_EMPTY_LABEL = "Niet aangeboden";
export const RATING_EMPTY_MEANING = "Nog niet aangeboden of geëvalueerd";

/** Index voor een consistente sorteervolgorde (kleuren eerst, dan de statussen). Geen score. */
export const ratingRank = (r: Rating): number => {
  const i = RATINGS.indexOf(r);
  return i === -1 ? RATINGS.length + STATUSSEN.indexOf(r) : i;
};
