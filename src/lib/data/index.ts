import { firebasePersistentie } from "./firebasePersistentie";
import { localStoragePersistentie } from "./localStoragePersistentie";
import type { BadgeboekPersistentie } from "./persistentie";

export type { BadgeboekPersistentie, PersistedStore, RauweStore } from "./persistentie";
export { sessieOpslag } from "./sessieOpslag";
export { auth, db, meldAanMetGoogle, meldAfVanFirebase, abonneerAuth } from "./firebaseApp";

export type PersistentieModus = "local" | "firebase";

/** Gekozen via `VITE_PERSISTENTIE` (`.env`); standaard `firebase`. */
export const PERSISTENTIE_MODUS: PersistentieModus =
  import.meta.env.VITE_PERSISTENTIE === "local" ? "local" : "firebase";

/** Bouwt de persistentielaag die de store gebruikt. Eén plek om van backend te wisselen. */
export function maakPersistentie(): BadgeboekPersistentie {
  switch (PERSISTENTIE_MODUS) {
    case "local":
      return localStoragePersistentie();
    default:
      return firebasePersistentie();
  }
}

