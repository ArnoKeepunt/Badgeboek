import { useStore } from "./store";
import type { Mentor, Student } from "./types";

/**
 * De effectieve rol. Zonder aanmelding werk je als **beheerder** — volledige toegang.
 * Meld je aan als mentor of leerling om hun weergave te zien.
 */
export type EffectieveRol = "beheerder" | "mentor" | "leerling";

export function useEffectieveRol(): EffectieveRol {
  const { sessie } = useStore();
  return sessie?.rol ?? "beheerder";
}

/** De aangemelde gebruiker, uitgezocht uit de sessie. `null` = beheerdersmodus. */
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
