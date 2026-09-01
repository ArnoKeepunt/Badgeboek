import { useSyncExternalStore } from "react";
import { doelKleuren as seedKleuren, students as seedStudents } from "./mockData";
import { HUIDIG_SCHOOLJAAR, isAfgesloten } from "./schooljaar";
import type { DoelKleuren, Groep, Rating, Student } from "./types";
import { doelSleutel } from "./types";

/**
 * Kleine browser-store zodat mentoren kleuren per leerdoel kunnen invullen en die
 * bewaard blijven. Enkel voor het prototype — later vervangen door een echte API/store.
 * Alles zit in localStorage onder één sleutel; elke mutatie vervangt `state` door een
 * nieuw object zodat useSyncExternalStore de abonnees opnieuw rendert.
 */

const STORAGE_KEY = "keerpunt-badgeboek:v4";

interface State {
  students: Student[];
  /** Sleutel `${schooljaar}:${studentId}:${leerdoelId}` → kleur. Ontbrekend = niet aangeboden. */
  kleuren: DoelKleuren;
  /** Zelfgemaakte leerlingengroepen. */
  groepen: Groep[];
  /** Het schooljaar dat momenteel bekeken/bewerkt wordt. */
  schooljaar: string;
}

const seed = (): State => ({
  students: seedStudents,
  kleuren: seedKleuren,
  groepen: [],
  schooljaar: HUIDIG_SCHOOLJAAR,
});

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...seed(), ...(JSON.parse(raw) as Partial<State>) };
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

/** Zet (of wis, met `null`) de kleur van een leerdoel voor één leerling, schooljaar en periode. */
export function setDoelKleur(
  schooljaar: string,
  periode: string,
  studentId: string,
  leerdoelId: string,
  kleur: Rating | null,
) {
  // Een afgesloten schooljaar staat vast: negeer wijzigingen.
  if (isAfgesloten(schooljaar)) return;
  const sleutel = doelSleutel(schooljaar, periode, studentId, leerdoelId);
  const kleuren = { ...state.kleuren };
  if (kleur) kleuren[sleutel] = kleur;
  else delete kleuren[sleutel];
  commit({ ...state, kleuren });
}

/** Lees de kleur van een leerdoel voor één leerling, schooljaar en periode (`null` = niet aangeboden). */
export function getDoelKleur(
  kleuren: DoelKleuren,
  schooljaar: string,
  periode: string,
  studentId: string,
  leerdoelId: string,
): Rating | null {
  return kleuren[doelSleutel(schooljaar, periode, studentId, leerdoelId)] ?? null;
}

/** Wissel het bekeken schooljaar. */
export function setSchooljaar(schooljaar: string) {
  commit({ ...state, schooljaar });
}

// --- Eigen groepen ---------------------------------------------------------

/** Maak een nieuwe groep en geef de id terug. */
export function maakGroep(naam: string, leerlingIds: string[]): string {
  const id = `g${Date.now().toString(36)}`;
  commit({ ...state, groepen: [...state.groepen, { id, naam, leerlingIds }] });
  return id;
}

/** Wijzig naam en/of leden van een bestaande groep. */
export function wijzigGroep(id: string, patch: Partial<Omit<Groep, "id">>) {
  commit({
    ...state,
    groepen: state.groepen.map((g) => (g.id === id ? { ...g, ...patch } : g)),
  });
}

/** Verwijder een groep. */
export function verwijderGroep(id: string) {
  commit({ ...state, groepen: state.groepen.filter((g) => g.id !== id) });
}

/** Wis alle lokale aanpassingen en ga terug naar de seed-data. */
export function resetStore() {
  commit(seed());
}
