import { firebasePersistentie } from "./firebasePersistentie";
import { localStoragePersistentie } from "./localStoragePersistentie";
import type { BadgeboekPersistentie } from "./persistentie";

export type { BadgeboekPersistentie, PersistedStore, RauweStore } from "./persistentie";
export { sessieOpslag } from "./sessieOpslag";

export type PersistentieModus = "local" | "firebase";

/** Gekozen via `VITE_PERSISTENTIE` (`.env`); standaard `local`. */
export const PERSISTENTIE_MODUS: PersistentieModus =
  import.meta.env.VITE_PERSISTENTIE === "firebase" ? "firebase" : "local";

/** Bouwt de persistentielaag die de store gebruikt. Eén plek om van backend te wisselen. */
export function maakPersistentie(): BadgeboekPersistentie {
  switch (PERSISTENTIE_MODUS) {
    case "firebase":
      return firebasePersistentie();
    default:
      return localStoragePersistentie();
  }
}
