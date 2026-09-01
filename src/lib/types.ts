/** De evaluatiekleuren. `null` = nog niet aangeboden / geëvalueerd (de lege staat). */
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
  /** 1 t/m 6. De graad is hieruit afgeleid (1-2 = 1e graad, 3-4 = 2e, 5-6 = 3e). */
  leerjaar: number;
  /** Klasgroep binnen het leerjaar, bv. "A" of "B". */
  klasgroep: string;
}

/** Zelfgemaakte leerlingengroep: een naam + een verzameling leerlingen. */
export interface Groep {
  id: string;
  naam: string;
  leerlingIds: string[];
}

/**
 * Kleur per (schooljaar, periode, leerling, leerdoel). Bewaard als één map met sleutel
 * `${schooljaar}:${periode}:${studentId}:${leerdoelId}`, waarbij `periode` "algemeen" of
 * een rapportperiode ("p1"…"p4") is. Een ontbrekende sleutel betekent "nog niet
 * aangeboden / geëvalueerd".
 */
export type DoelKleuren = Record<string, Rating>;

export const doelSleutel = (
  schooljaar: string,
  periode: string,
  studentId: string,
  leerdoelId: string,
): string => `${schooljaar}:${periode}:${studentId}:${leerdoelId}`;
