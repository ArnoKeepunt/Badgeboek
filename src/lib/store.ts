import { useSyncExternalStore } from "react";
import { doelKleuren as seedKleuren, students as seedStudents } from "./mockData";
import type { DoelKleuren, Rating, Student } from "./types";
import { doelSleutel } from "./types";

/**
 * Kleine browser-store zodat mentoren kleuren per leerdoel kunnen invullen en die
 * bewaard blijven. Enkel voor het prototype — later vervangen door een echte API/store.
 * Alles zit in localStorage onder één sleutel; elke mutatie vervangt `state` door een
 * nieuw object zodat useSyncExternalStore de abonnees opnieuw rendert.
 */

const STORAGE_KEY = "keerpunt-badgeboek:v2";

interface State {
  students: Student[];
  /** Sleutel `${studentId}:${leerdoelId}` → kleur. Ontbrekend = niet aangeboden. */
  kleuren: DoelKleuren;
}

const seed = (): State => ({
  students: seedStudents,
  kleuren: seedKleuren,
});

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    // Privémodus, uitgeschakelde opslag of corrupte JSON — terugvallen op seed.
  }
  return seed();
}

let state: State = load();
const listeners = new Set<() => void>();

function commit(next: State) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Opslagfouten negeren; state leeft nog in het geheugen voor deze sessie.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** Lees de volledige store; rendert opnieuw bij elke wijziging. */
export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state);
}

/** Zet (of wis, met `null`) de kleur van een leerdoel voor één leerling. */
export function setDoelKleur(
  studentId: string,
  leerdoelId: string,
  kleur: Rating | null,
) {
  const sleutel = doelSleutel(studentId, leerdoelId);
  const kleuren = { ...state.kleuren };
  if (kleur) kleuren[sleutel] = kleur;
  else delete kleuren[sleutel];
  commit({ ...state, kleuren });
}

/** Lees de kleur van een leerdoel voor één leerling (`null` = niet aangeboden). */
export function getDoelKleur(
  kleuren: DoelKleuren,
  studentId: string,
  leerdoelId: string,
): Rating | null {
  return kleuren[doelSleutel(studentId, leerdoelId)] ?? null;
}

/** Wis alle lokale aanpassingen en ga terug naar de seed-data. */
export function resetStore() {
  commit(seed());
}
