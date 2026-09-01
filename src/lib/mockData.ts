import { leerdoelenVoorStroom } from "./curriculum";
import { stroomVan } from "./leerlingen";
import type { PeriodeId } from "./periode";
import { seedLeerlingen, seedMentoren } from "./seedGebruikers";
import type { DoelKleuren, Mentor, Rating, Student } from "./types";
import { doelSleutel } from "./types";

/** Seed-data uit de fictieve-gebruikerslijst. Vervangbaar via CSV-import op /gegevens. */
export const students: Student[] = seedLeerlingen;
export const mentoren: Mentor[] = seedMentoren;

/** Deterministische "hash" van een string → niet-negatief getal. */
const hash = (s: string): number =>
  [...s].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);

/** Deterministische kleur voor een ingevulde cel. */
function seedKleur(bron: string): Rating {
  switch (hash(bron) % 5) {
    case 0:
      return "red";
    case 1:
      return "yellow";
    case 2:
    case 3:
      return "green";
    default:
      return "blue";
  }
}

/**
 * Per schooljaar: de kans dat een cel al ingevuld is, en welke periodes al data hebben.
 * Enkel de eerste leerlingen krijgen seed-kleuren — anders wordt localStorage te groot.
 */
const SEED_CONFIG: Record<string, { dichtheid: number; periodes: PeriodeId[] }> = {
  "2024-2025": { dichtheid: 0.85, periodes: ["algemeen", "p1", "p2"] },
  "2025-2026": { dichtheid: 0.6, periodes: ["algemeen", "p1"] },
  "2026-2027": { dichtheid: 0.12, periodes: ["p1"] },
};

const GESEEDE_LEERLINGEN = students.slice(0, 16);

/** De badges van elke geseede leerling, volgens zijn/haar eigen stroom (1A, 1B, 2A, 3A). */
const DOELEN_PER_LEERLING = new Map(
  GESEEDE_LEERLINGEN.map((s) => [s.id, leerdoelenVoorStroom(stroomVan(s))]),
);

export const doelKleuren: DoelKleuren = (() => {
  const map: DoelKleuren = {};
  for (const [schooljaar, { dichtheid, periodes }] of Object.entries(SEED_CONFIG)) {
    for (const periode of periodes) {
      for (const student of GESEEDE_LEERLINGEN) {
        for (const doel of DOELEN_PER_LEERLING.get(student.id) ?? []) {
          const bron = `${schooljaar}:${periode}:${student.id}:${doel.id}`;
          if ((hash(`${bron}#fill`) % 100) / 100 < dichtheid) {
            map[doelSleutel(schooljaar, periode, student.id, doel.id)] = seedKleur(bron);
          }
        }
      }
    }
  }
  return map;
})();
