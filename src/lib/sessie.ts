import { useHuidigPersoneelslid } from "./firebaseAuth";
import { useStore } from "./store";
import type { Mentor, Student } from "./types";

/**
 * De effectieve rol waarmee de app zich gedraagt.
 *
 * - Bij een Firebase-login komt de rol uit het personeelsaccount (`gebruikers/{email}`):
 *   `beheerder` | `coordinator` | `mentor`.
 * - De demo-`sessie` in de store is de **"bekijk als"-override** (enkel door een beheerder te
 *   zetten via `/aanmelden`): tijdelijk de weergave van een leerling of mentor testen.
 * - Zonder beide (local-modus) → `beheerder`, zoals vroeger.
 */
export type EffectieveRol = "beheerder" | "coordinator" | "mentor" | "leerling";

export function useEffectieveRol(): EffectieveRol {
  const { sessie } = useStore();
  const { persoon } = useHuidigPersoneelslid();
  if (sessie) return sessie.rol; // "bekijk als" leerling/mentor
  if (persoon?.actief) return persoon.rol;
  return "beheerder";
}

/** De aangemelde gebruiker via de "bekijk als"-kiezer. `null` = geen bekijk-als actief. */
export type Aangemeld =
  | { rol: "leerling"; leerling: Student }
  | { rol: "mentor"; mentor: Mentor }
  | null;

export function useAangemeld(): Aangemeld {
  const { sessie, students, mentoren } = useStore();
  if (!sessie) return null;
  if (sessie.rol === "leerling") {
    const leerling = students.find((s) => s.id === sessie.id);
    return leerling ? { rol: "leerling", leerling } : null;
  }
  const mentor = mentoren.find((m) => m.id === sessie.id);
  return mentor ? { rol: "mentor", mentor } : null;
}

export const naamVan = (a: Aangemeld): string => {
  if (!a) return "";
  return a.rol === "leerling"
    ? `${a.leerling.firstName} ${a.leerling.lastName}`
    : `${a.mentor.voornaam} ${a.mentor.naam}`;
};
