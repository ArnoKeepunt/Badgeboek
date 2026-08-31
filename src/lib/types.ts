/** Beoordelingskleuren, zwak → sterk. `null` = nog niet aangeboden / geëvalueerd. */
export type Rating = 'red' | 'yellow' | 'green' | 'blue'

/**
 * Doelcategorie (zie badgeboek):
 * - `standaard`         : de meeste doelen
 * - `basisgeletterdheid`: moet door elke leerling afzonderlijk behaald worden (BG)
 * - `uitbreiding`       : niet verplicht, voor sterkere leerlingen (U/UB)
 * - `freinet`           : specifiek voor de studierichting Freinetpedagogie (F)
 */
export type DoelCategorie = "standaard" | "basisgeletterdheid" | "uitbreiding" | "freinet";

export interface Cursus {
  id: string;
  naam: string;
  graad: number;
}

/** Bundeling van leerdoelen binnen een cursus (soms 'cluster' genoemd). */
export interface Rubric {
  id: string;
  cursusId: string;
  naam: string;
}

export interface Leerdoel {
  id: string;
  rubricId: string;
  omschrijving: string;
  categorie: DoelCategorie;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  vestiging: string;
  leerjaar: number;
}

/**
 * Kleur per (leerling, leerdoel). Bewaard als map met sleutel `${studentId}:${leerdoelId}`.
 * Een ontbrekende sleutel betekent "nog niet aangeboden / geëvalueerd".
 */
export type DoelKleuren = Record<string, Rating>;

export const doelSleutel = (studentId: string, leerdoelId: string): string =>
  `${studentId}:${leerdoelId}`;
