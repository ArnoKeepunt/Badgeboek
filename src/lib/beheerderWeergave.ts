import { useSyncExternalStore } from "react";
import { beheerderWeergaveOpslag, type BeheerderWeergave } from "./data/beheerderWeergaveOpslag";

/**
 * "Beheerdersmodus uit": een beheerder is in de praktijk vaak gewoon mentor van een vestiging en
 * hoeft niet altijd de volledige beheerdersomgeving (Gebruikers/Vestigingen/Gegevens/Groepen +
 * alle vestigingen) te zien — dat kan veel zijn. Deze schakelaar is puur een client-side
 * weergavevoorkeur (per browser): ze wijzigt niets aan het echte account of de
 * Firestore-rechten, dus kan zonder herladen aan/uit en evengoed weer terug. Zie `useEffectieveRol`
 * (`sessie.ts`) en `useBereik` (`rechten.ts`) voor waar dit effect op heeft.
 */
let state = beheerderWeergaveOpslag.laad();
const luisteraars = new Set<() => void>();
const meld = () => luisteraars.forEach((fn) => fn());

export function zetVereenvoudigdeWeergave(vereenvoudigd: boolean): void {
  state = { vereenvoudigd };
  beheerderWeergaveOpslag.bewaar(state);
  meld();
}

const subscribe = (fn: () => void) => {
  luisteraars.add(fn);
  return () => luisteraars.delete(fn);
};
const snapshot = () => state;

export function useBeheerderWeergave(): BeheerderWeergave {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
