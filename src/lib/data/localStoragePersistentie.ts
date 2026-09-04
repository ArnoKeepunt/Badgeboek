import type { BadgeboekPersistentie, PersistedStore, RauweStore } from "./persistentie";

const STORE_KEY = "keerpunt-badgeboek:v8";

/**
 * De huidige opslag: één JSON-blob in `localStorage`. Bonus: `abonneer()` luistert naar het
 * `storage`-event, zodat een tweede tab in dezelfde browser meteen mee-update.
 */
export function localStoragePersistentie(storeKey: string = STORE_KEY): BadgeboekPersistentie {
  return {
    naam: "localStorage",

    laadDirect(): RauweStore | null {
      try {
        const raw = localStorage.getItem(storeKey);
        return raw ? (JSON.parse(raw) as RauweStore) : null;
      } catch {
        // privémodus, uitgeschakelde opslag of corrupte JSON
        return null;
      }
    },

    bewaar(store: PersistedStore): void {
      try {
        localStorage.setItem(storeKey, JSON.stringify(store));
      } catch {
        // opslagfouten negeren; de state leeft nog in het geheugen voor deze sessie
      }
    },

    abonneer(luister: (store: RauweStore) => void): () => void {
      const onStorage = (e: StorageEvent) => {
        if (e.key !== storeKey || !e.newValue) return;
        try {
          luister(JSON.parse(e.newValue) as RauweStore);
        } catch {
          // corrupte payload van de andere tab — negeren
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
  };
}
