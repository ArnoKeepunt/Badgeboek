import { leerdoelen } from "./curriculum";
import type { PeriodeId } from "./periode";
import type { DoelKleuren, Rating, Student } from "./types";
import { doelSleutel } from "./types";

/** Seed-data — vervang later door een echte databron. Wordt gebruikt tot je iets aanpast. */
export const students: Student[] = [
  { id: "s1", firstName: "Emma", lastName: "Janssens", vestiging: "Gent", leerjaar: 2, klasgroep: "A" },
  { id: "s2", firstName: "Lucas", lastName: "Peeters", vestiging: "Gent", leerjaar: 2, klasgroep: "A" },
  { id: "s3", firstName: "Noor", lastName: "De Vries", vestiging: "Brugge", leerjaar: 1, klasgroep: "B" },
  { id: "s4", firstName: "Milan", lastName: "Maes", vestiging: "Brugge", leerjaar: 1, klasgroep: "B" },
  { id: "s5", firstName: "Amir", lastName: "Haddad", vestiging: "Gent", leerjaar: 1, klasgroep: "A" },
  { id: "s6", firstName: "Lena", lastName: "Willems", vestiging: "Gent", leerjaar: 3, klasgroep: "A" },
  { id: "s7", firstName: "Ravi", lastName: "Patel", vestiging: "Gent", leerjaar: 4, klasgroep: "A" },
  { id: "s8", firstName: "Fien", lastName: "Claes", vestiging: "Gent", leerjaar: 4, klasgroep: "B" },
  { id: "s9", firstName: "Jonas", lastName: "Hermans", vestiging: "Brugge", leerjaar: 3, klasgroep: "B" },
  { id: "s10", firstName: "Yasmine", lastName: "Bakker", vestiging: "Brugge", leerjaar: 5, klasgroep: "A" },
  { id: "s11", firstName: "Tuur", lastName: "Vermeulen", vestiging: "Gent", leerjaar: 6, klasgroep: "A" },
  { id: "s12", firstName: "Sara", lastName: "Aydin", vestiging: "Gent", leerjaar: 6, klasgroep: "B" },
  { id: "s13", firstName: "Wout", lastName: "Declercq", vestiging: "Brugge", leerjaar: 2, klasgroep: "B" },
  { id: "s14", firstName: "Nina", lastName: "Coppens", vestiging: "Brugge", leerjaar: 5, klasgroep: "B" },
];

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
 * Zo ontstaat het verschil tussen vaste content (2024-2025, afgesloten, alle rapporten +
 * algemeen, zo goed als vol), nog aanpasbare content (2025-2026, open, rapport 1-3 +
 * algemeen) en content waar nog aan begonnen moet worden (2026-2027, lopend schooljaar,
 * enkel rapport 1, grotendeels leeg).
 */
const SEED_CONFIG: Record<string, { dichtheid: number; periodes: PeriodeId[] }> = {
  "2024-2025": { dichtheid: 0.92, periodes: ["algemeen", "p1", "p2", "p3", "p4"] },
  "2025-2026": { dichtheid: 0.78, periodes: ["algemeen", "p1", "p2", "p3"] },
  "2026-2027": { dichtheid: 0.14, periodes: ["p1"] },
};

export const doelKleuren: DoelKleuren = (() => {
  const map: DoelKleuren = {};
  for (const [schooljaar, { dichtheid, periodes }] of Object.entries(SEED_CONFIG)) {
    for (const periode of periodes) {
      for (const student of students) {
        for (const doel of leerdoelen) {
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
