import { leerdoelen } from "./curriculum";
import type { DoelKleuren, Rating, Student } from "./types";
import { doelSleutel } from "./types";

/** Seed-data — vervang later door een echte databron. Wordt gebruikt tot je iets aanpast. */
export const students: Student[] = [
  { id: "s1", firstName: "Emma", lastName: "Janssens", vestiging: "Gent", leerjaar: 2 },
  { id: "s2", firstName: "Lucas", lastName: "Peeters", vestiging: "Gent", leerjaar: 2 },
  { id: "s3", firstName: "Noor", lastName: "De Vries", vestiging: "Brugge", leerjaar: 1 },
  { id: "s4", firstName: "Milan", lastName: "Maes", vestiging: "Brugge", leerjaar: 1 },
  { id: "s5", firstName: "Amir", lastName: "Haddad", vestiging: "Gent", leerjaar: 1 },
];

/**
 * Deterministische seed voor de kleur per (leerling, leerdoel), zodat de matrix
 * niet leeg is. Ongeveer 1 op 6 blijft "niet aangeboden" (ontbrekende sleutel).
 */
function seedKleur(studentId: string, leerdoelId: string): Rating | null {
  const som = [...(studentId + leerdoelId)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  switch (som % 6) {
    case 0:
      return null; // niet aangeboden
    case 1:
      return "red";
    case 2:
      return "yellow";
    case 3:
    case 4:
      return "green";
    default:
      return "blue";
  }
}

export const doelKleuren: DoelKleuren = (() => {
  const map: DoelKleuren = {};
  for (const student of students) {
    for (const doel of leerdoelen) {
      const kleur = seedKleur(student.id, doel.id);
      if (kleur) map[doelSleutel(student.id, doel.id)] = kleur;
    }
  }
  return map;
})();
