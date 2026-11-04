import { useMemo, useSyncExternalStore } from "react";
import { PERSISTENTIE_MODUS, abonneerCollegas, type Collega } from "./data";
import { useStore } from "./store";

export type { Collega };

/**
 * De collega's die een mentor kan kiezen als mee-mentor van een groep (en waarvan de namen bij
 * een groep getoond worden). In firebase-modus de `collegas`-collectie (zie `firebaseApp.ts`),
 * in local-modus de demo-mentoren. Eén gedeelde Firestore-luisteraar voor de hele app, gestart
 * bij het eerste gebruik (dus pas na het aanmelden) en gestopt als niemand meer luistert.
 */

let lijst: Collega[] = [];
let stop: (() => void) | null = null;
const luisteraars = new Set<() => void>();

function subscribe(fn: () => void) {
  luisteraars.add(fn);
  if (!stop) {
    stop = abonneerCollegas((l) => {
      lijst = l;
      luisteraars.forEach((x) => x());
    });
  }
  return () => {
    luisteraars.delete(fn);
    if (luisteraars.size === 0 && stop) {
      stop();
      stop = null;
    }
  };
}

const geenAbonnement = () => () => {};
const leeg: Collega[] = [];

/** Alle collega's (ook inactieve — voor het tonen van namen), alfabetisch. */
export function useCollegas(): Collega[] {
  const firebase = PERSISTENTIE_MODUS === "firebase";
  const vanFirebase = useSyncExternalStore(
    firebase ? subscribe : geenAbonnement,
    () => (firebase ? lijst : leeg),
  );
  const { mentoren } = useStore();
  return useMemo(() => {
    const bron: Collega[] = firebase
      ? vanFirebase
      : mentoren.map((m) => ({
          id: m.id,
          naam: `${m.voornaam} ${m.naam}`,
          vestigingen: m.vestiging ? [m.vestiging] : [],
          actief: true,
        }));
    return [...bron].sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  }, [firebase, vanFirebase, mentoren]);
}

/** Hook: `id → naam` (valt terug op de id zelf, bv. een e-mailadres zonder collega-doc). */
export function useCollegaNaam(): (id: string) => string {
  const collegas = useCollegas();
  return useMemo(() => {
    const m = new Map(collegas.map((c) => [c.id, c.naam]));
    return (id: string) => m.get(id) ?? id;
  }, [collegas]);
}
