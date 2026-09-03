import { useSyncExternalStore } from "react";
import { cursusVanLeerdoel } from "./curriculum";
import {
  deelKleuren as seedDeelKleuren,
  seedDeelevaluaties,
  doelKleuren as seedKleuren,
  seedMeldingen,
  mentoren as seedMentoren,
  students as seedStudents,
} from "./mockData";
import type { Minimumdoel } from "./minimumdoelen";
import { ALGEMEEN, type PeriodeId } from "./periode";
import { HUIDIG_SCHOOLJAAR, isAfgesloten } from "./schooljaar";
import type {
  Basisrol,
  DeelKleuren,
  Deelevaluatie,
  DoelKleuren,
  Groep,
  Melding,
  Mentor,
  Notitie,
  Notities,
  Rating,
  Sessie,
  Stroom,
  Student,
} from "./types";
import {
  LEGE_NOTITIE,
  STROMEN,
  deelSleutel,
  doelSleutel,
  notitieSleutel,
} from "./types";

/**
 * Kleine browser-store zodat mentoren kleuren per leerdoel kunnen invullen en die
 * bewaard blijven. Enkel voor het prototype — later vervangen door een echte API/store.
 * Alles zit in localStorage onder één sleutel; elke mutatie vervangt `state` door een
 * nieuw object zodat useSyncExternalStore de abonnees opnieuw rendert.
 */

const STORAGE_KEY = "keerpunt-badgeboek:v7";
const SESSIE_KEY = "keerpunt-badgeboek:sessie";

interface State {
  students: Student[];
  mentoren: Mentor[];
  /** Wie er is aangemeld (per browsertab). */
  sessie: Sessie | null;
  /** Sleutel `${schooljaar}:${studentId}:${leerdoelId}` → kleur. Ontbrekend = niet aangeboden. */
  kleuren: DoelKleuren;
  /** Notities per badge/leerling/schooljaar (zichtbaar + verborgen). */
  notities: Notities;
  /** Zelfgemaakte leerlingengroepen. */
  groepen: Groep[];
  /** Het schooljaar dat momenteel bekeken/bewerkt wordt. */
  schooljaar: string;
  /** De rapportperiode die in de badgematrix bekeken/bewerkt wordt (gedeeld met het overzicht). */
  periode: PeriodeId;
  /** De graad/stromen die in de badgematrix getoond worden (minstens één). */
  matrixStromen: Stroom[];
  /**
   * Bewerkingen aan minimumdoelen, per code. De basislijst blijft een statische import;
   * deze patches worden er bij het lezen bovenop gelegd.
   */
  doelWijzigingen: Record<string, Partial<Minimumdoel>>;
  /** Ingeladen doelenlijst via CSV. `null` = de standaardlijst gebruiken. */
  doelenImport: Minimumdoel[] | null;
  /** Door leerkrachten aangemaakte deelevaluaties (toetsen/opdrachten). */
  deelevaluaties: Deelevaluatie[];
  /** Sleutel `${deelevaluatieId}:${studentId}` → kleur. Ontbrekend = niet gemaakt. */
  deelKleuren: DeelKleuren;
  /** Meldingen voor het leerling-meldingencentrum (nieuwste eerst, gemaximeerd). */
  meldingen: Melding[];
  /** Per leerling: tijdstip waarop het meldingencentrum voor het laatst bekeken werd. */
  meldingGezien: Record<string, number>;
  /**
   * Kleursleutels (kleuren én deelKleuren) die de gebruiker bewust heeft leeggemaakt. Bij het
   * herladen leggen we de seed-data er niet meer onder voor deze sleutels, zodat een gewiste
   * kleur ook weg blijft.
   */
  gewist: string[];
}

const MAX_MELDINGEN = 120;
const MAX_GEWIST = 1000;

const seed = (): State => ({
  students: seedStudents,
  mentoren: seedMentoren,
  sessie: null,
  kleuren: seedKleuren,
  notities: {},
  groepen: [],
  schooljaar: HUIDIG_SCHOOLJAAR,
  periode: ALGEMEEN,
  matrixStromen: ["1A"],
  doelWijzigingen: {},
  doelenImport: null,
  deelevaluaties: seedDeelevaluaties,
  deelKleuren: seedDeelKleuren,
  meldingen: seedMeldingen,
  meldingGezien: {},
  gewist: [],
});

function laadSessie(): Sessie | null {
  try {
    const raw = sessionStorage.getItem(SESSIE_KEY);
    return raw ? (JSON.parse(raw) as Sessie) : null;
  } catch {
    return null;
  }
}

function load(): State {
  const standaard = seed();
  let basis = standaard;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const bewaard = JSON.parse(raw) as Partial<State> & { matrixStroom?: Stroom };
      basis = { ...standaard, ...bewaard };
      // De seed-evaluaties en -notities blijven onder de bewaarde waarden liggen: zo verschijnt
      // nieuwe demo-data (bv. voor 1B/2A/3A-leerlingen) zonder dat een eigen kleur of notitie
      // sneuvelt — een handmatige waarde wint altijd van de seed.
      basis.kleuren = { ...standaard.kleuren, ...(bewaard.kleuren ?? {}) };
      basis.notities = { ...standaard.notities, ...(bewaard.notities ?? {}) };
      basis.deelKleuren = { ...standaard.deelKleuren, ...(bewaard.deelKleuren ?? {}) };
      // Bewust gewiste kleuren blijven weg, ook al zit er seed-data onder.
      basis.gewist = Array.isArray(bewaard.gewist) ? bewaard.gewist : [];
      for (const k of basis.gewist) {
        delete basis.kleuren[k];
        delete basis.deelKleuren[k];
      }
      // De voorbeeld-deelevaluaties/-meldingen blijven staan tot er echte data is.
      if (!Array.isArray(bewaard.deelevaluaties)) basis.deelevaluaties = standaard.deelevaluaties;
      if (!Array.isArray(bewaard.meldingen)) basis.meldingen = standaard.meldingen;
      if (!bewaard.meldingGezien) basis.meldingGezien = standaard.meldingGezien;
      // Migratie: vroeger één stroom (`matrixStroom`), nu een lijst (`matrixStromen`).
      if (!Array.isArray(bewaard.matrixStromen)) {
        basis.matrixStromen = bewaard.matrixStroom ? [bewaard.matrixStroom] : standaard.matrixStromen;
      }
    }
  } catch {
    // Privémodus, uitgeschakelde opslag of corrupte JSON — terugvallen op seed.
  }
  // De sessie leeft per browsertab, los van de rest.
  return { ...basis, sessie: laadSessie() };
}

let state: State = load();
const listeners = new Set<() => void>();

function commit(next: State) {
  state = next;
  try {
    const { sessie, ...rest } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    if (sessie) sessionStorage.setItem(SESSIE_KEY, JSON.stringify(sessie));
    else sessionStorage.removeItem(SESSIE_KEY);
  } catch {
    // Opslagfouten negeren; state leeft nog in het geheugen voor deze sessie.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

// --- Gewiste kleuren (blijven weg bij herladen) -------------------------

function pasGewistAan(gewist: string[], sleutel: string, kleur: Rating | null): string[] {
  const erin = gewist.includes(sleutel);
  if (kleur) return erin ? gewist.filter((x) => x !== sleutel) : gewist;
  return erin ? gewist : [...gewist, sleutel].slice(-MAX_GEWIST);
}

// --- Meldingen (leerling-meldingencentrum) ------------------------------

const cursusInfoVoorLeerdoel = (leerdoelId: string) => {
  const c = cursusVanLeerdoel(leerdoelId);
  return { cursusId: c?.id ?? "", cursusNaam: c?.naam ?? "je badges" };
};

/**
 * Voeg een melding toe. Is er voor dezelfde leerling + cursus + soort al een ongelezen melding,
 * dan wordt die opgehoogd (teller + tijdstip) i.p.v. een nieuwe regel toe te voegen.
 */
function metMelding(
  lijst: Melding[],
  base: Omit<Melding, "id" | "ts" | "aantal">,
): Melding[] {
  const ts = Date.now();
  const gezien = state.meldingGezien[base.studentId] ?? 0;
  const idx = lijst.findIndex(
    (m) =>
      m.studentId === base.studentId &&
      m.cursusId === base.cursusId &&
      m.soort === base.soort &&
      m.ts > gezien,
  );
  if (idx >= 0) {
    const bij = { ...lijst[idx], ts, aantal: lijst[idx].aantal + 1 };
    return [bij, ...lijst.slice(0, idx), ...lijst.slice(idx + 1)];
  }
  const id = `m${ts.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return [{ id, ts, aantal: 1, ...base }, ...lijst].slice(0, MAX_MELDINGEN);
}

/** Meldingen voor één leerling, nieuwste eerst. */
export const meldingenVoor = (meldingen: Melding[], studentId: string): Melding[] =>
  meldingen.filter((m) => m.studentId === studentId);

/** Aantal ongelezen meldingen voor één leerling. */
export const aantalOngelezen = (
  meldingen: Melding[],
  meldingGezien: Record<string, number>,
  studentId: string,
): number => {
  const gezien = meldingGezien[studentId] ?? 0;
  return meldingen.filter((m) => m.studentId === studentId && m.ts > gezien).length;
};

/** Markeer alle meldingen van een leerling als gelezen. */
export function markMeldingenGezien(studentId: string) {
  commit({
    ...state,
    meldingGezien: { ...state.meldingGezien, [studentId]: Date.now() },
  });
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
  const verandert = kleur !== null && state.kleuren[sleutel] !== kleur;
  const kleuren = { ...state.kleuren };
  if (kleur) kleuren[sleutel] = kleur;
  else delete kleuren[sleutel];
  const meldingen =
    verandert && schooljaar === HUIDIG_SCHOOLJAAR
      ? metMelding(state.meldingen, {
          studentId,
          soort: "kleur",
          ...cursusInfoVoorLeerdoel(leerdoelId),
        })
      : state.meldingen;
  commit({ ...state, kleuren, meldingen, gewist: pasGewistAan(state.gewist, sleutel, kleur) });
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

/** Zet dezelfde kleur voor meerdere leerlingen tegelijk (één opslagbeurt). */
export function setDoelKleurBulk(
  schooljaar: string,
  periode: string,
  studentIds: string[],
  leerdoelId: string,
  kleur: Rating | null,
) {
  if (isAfgesloten(schooljaar)) return;
  const kleuren = { ...state.kleuren };
  const logt = kleur !== null && schooljaar === HUIDIG_SCHOOLJAAR;
  const cursusInfo = logt ? cursusInfoVoorLeerdoel(leerdoelId) : null;
  let meldingen = state.meldingen;
  let gewist = state.gewist;
  for (const studentId of studentIds) {
    const sleutel = doelSleutel(schooljaar, periode, studentId, leerdoelId);
    const verandert = kleur !== null && kleuren[sleutel] !== kleur;
    if (kleur) kleuren[sleutel] = kleur;
    else delete kleuren[sleutel];
    gewist = pasGewistAan(gewist, sleutel, kleur);
    if (verandert && cursusInfo) {
      meldingen = metMelding(meldingen, { studentId, soort: "kleur", ...cursusInfo });
    }
  }
  commit({ ...state, kleuren, meldingen, gewist });
}

// --- Notities ------------------------------------------------------------

export function getNotitie(
  notities: Notities,
  schooljaar: string,
  studentId: string,
  leerdoelId: string,
): Notitie {
  return notities[notitieSleutel(schooljaar, studentId, leerdoelId)] ?? LEGE_NOTITIE;
}

/** Werk een notitie bij; verdwijnt als beide velden leeg zijn. */
export function zetNotitie(
  schooljaar: string,
  studentId: string,
  leerdoelId: string,
  patch: Partial<Notitie>,
) {
  if (isAfgesloten(schooljaar)) return;
  const sleutel = notitieSleutel(schooljaar, studentId, leerdoelId);
  const huidig = state.notities[sleutel] ?? LEGE_NOTITIE;
  const nieuw: Notitie = {
    zichtbaar: (patch.zichtbaar ?? huidig.zichtbaar).trim(),
    verborgen: (patch.verborgen ?? huidig.verborgen).trim(),
  };
  const notities = { ...state.notities };
  if (nieuw.zichtbaar || nieuw.verborgen) notities[sleutel] = nieuw;
  else delete notities[sleutel];
  commit({ ...state, notities });
}

/** Wissel het bekeken schooljaar. */
export function setSchooljaar(schooljaar: string) {
  commit({ ...state, schooljaar });
}

/** Wissel de rapportperiode (gedeeld tussen overzicht en badgematrix). */
export function setPeriode(periode: PeriodeId) {
  commit({ ...state, periode });
}

/** Zet de getoonde stromen van de badgematrix (in vaste volgorde, minstens één). */
export function setMatrixStromen(stromen: Stroom[]) {
  const uniek = STROMEN.filter((s) => stromen.includes(s));
  commit({ ...state, matrixStromen: uniek.length > 0 ? uniek : ["1A"] });
}

/** Zet één stroom aan of uit in de badgematrix (de laatste actieve stroom blijft staan). */
export function toggleMatrixStroom(stroom: Stroom) {
  const actief = state.matrixStromen.includes(stroom);
  if (actief && state.matrixStromen.length === 1) return;
  setMatrixStromen(
    actief
      ? state.matrixStromen.filter((s) => s !== stroom)
      : [...state.matrixStromen, stroom],
  );
}

// --- Aanmelden ------------------------------------------------------------

/** Meld aan als een gebruiker (rol + id). Enkel voor deze tab. */
export function meldAan(rol: Basisrol, id: string) {
  commit({ ...state, sessie: { rol, id } });
}

export function meldAf() {
  commit({ ...state, sessie: null });
}

// --- Gebruikers (CSV-import) --------------------------------------------

/**
 * Voeg leerlingen toe of werk ze bij op basis van hun `id`. Bestaande leerlingen die niet in
 * de lijst zitten, blijven staan — zo gaan bij een jaarovergang geen evaluaties verloren.
 */
export function upsertStudenten(nieuwe: Student[]) {
  const perId = new Map(state.students.map((s) => [s.id, s]));
  for (const s of nieuwe) perId.set(s.id, { ...perId.get(s.id), ...s });
  commit({ ...state, students: [...perId.values()] });
}

/** Vervang de volledige leerlingenlijst (evaluaties van verdwenen id's blijven wel bewaard). */
export function vervangStudenten(nieuwe: Student[]) {
  commit({ ...state, students: nieuwe });
}

/** Voeg leerlingen én mentoren toe/bij op basis van hun `id`. */
export function importeerGebruikers(leerlingen: Student[], mentoren: Mentor[]) {
  const perLl = new Map(state.students.map((s) => [s.id, s]));
  for (const s of leerlingen) perLl.set(s.id, { ...perLl.get(s.id), ...s });
  const perMe = new Map(state.mentoren.map((m) => [m.id, m]));
  for (const m of mentoren) perMe.set(m.id, { ...perMe.get(m.id), ...m });
  commit({ ...state, students: [...perLl.values()], mentoren: [...perMe.values()] });
}

// --- Eigen groepen ---------------------------------------------------------

/** Maak een nieuwe groep en geef de id terug. Optioneel gekoppeld aan een mentor. */
export function maakGroep(naam: string, leerlingIds: string[], mentorId?: string): string {
  const id = `g${Date.now().toString(36)}`;
  commit({ ...state, groepen: [...state.groepen, { id, naam, leerlingIds, mentorId }] });
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

// --- Minimumdoelen ---------------------------------------------------------

/** Bewaar een bewerking aan één minimumdoel (op basis van zijn unieke code). */
export function wijzigDoel(
  code: string,
  patch: Partial<Omit<Minimumdoel, "code" | "stroom">>,
) {
  commit({
    ...state,
    doelWijzigingen: {
      ...state.doelWijzigingen,
      [code]: { ...state.doelWijzigingen[code], ...patch },
    },
  });
}

/** Zet een via CSV ingeladen doelenlijst (of `null` om terug naar de standaardlijst te gaan). */
export function zetDoelenImport(doelen: Minimumdoel[] | null) {
  commit({ ...state, doelenImport: doelen, doelWijzigingen: {} });
}

// --- Deelevaluaties -------------------------------------------------------

/** Maak een deelevaluatie aan en geef de id terug. */
export function maakDeelevaluatie(
  data: Omit<Deelevaluatie, "id">,
): string {
  const id = `de${Date.now().toString(36)}`;
  commit({ ...state, deelevaluaties: [...state.deelevaluaties, { ...data, id }] });
  return id;
}

/** Wijzig een deelevaluatie. */
export function wijzigDeelevaluatie(id: string, patch: Partial<Omit<Deelevaluatie, "id">>) {
  commit({
    ...state,
    deelevaluaties: state.deelevaluaties.map((d) => (d.id === id ? { ...d, ...patch } : d)),
  });
}

/** Verwijder een deelevaluatie én de bijhorende kleuren. */
export function verwijderDeelevaluatie(id: string) {
  const deelKleuren = { ...state.deelKleuren };
  for (const sleutel of Object.keys(deelKleuren)) {
    if (sleutel.startsWith(`${id}:`)) delete deelKleuren[sleutel];
  }
  commit({
    ...state,
    deelevaluaties: state.deelevaluaties.filter((d) => d.id !== id),
    deelKleuren,
  });
}

export function getDeelKleur(
  deelKleuren: DeelKleuren,
  deelevaluatieId: string,
  studentId: string,
): Rating | null {
  return deelKleuren[deelSleutel(deelevaluatieId, studentId)] ?? null;
}

const deelevaluatie = (id: string) => state.deelevaluaties.find((d) => d.id === id);
const deelevaluatieVergrendeld = (id: string): boolean => {
  const de = deelevaluatie(id);
  return de ? isAfgesloten(de.schooljaar) : false;
};

/** Melding-info (cursus) voor een deelevaluatie. `null` = niet loggen. */
const deelMeldingInfo = (id: string) => {
  const de = deelevaluatie(id);
  if (!de || de.schooljaar !== HUIDIG_SCHOOLJAAR) return null;
  return {
    soort: "deelevaluatie" as const,
    cursusId: cursusVanLeerdoel(de.leerdoelIds[0] ?? "")?.id ?? "",
    cursusNaam: de.cursus || "je badges",
  };
};

/** Zet (of wis) de kleur van één leerling op een deelevaluatie. */
export function setDeelKleur(
  deelevaluatieId: string,
  studentId: string,
  kleur: Rating | null,
) {
  if (deelevaluatieVergrendeld(deelevaluatieId)) return;
  const deelKleuren = { ...state.deelKleuren };
  const sleutel = deelSleutel(deelevaluatieId, studentId);
  const verandert = kleur !== null && deelKleuren[sleutel] !== kleur;
  if (kleur) deelKleuren[sleutel] = kleur;
  else delete deelKleuren[sleutel];
  const info = verandert ? deelMeldingInfo(deelevaluatieId) : null;
  const meldingen = info ? metMelding(state.meldingen, { studentId, ...info }) : state.meldingen;
  commit({
    ...state,
    deelKleuren,
    meldingen,
    gewist: pasGewistAan(state.gewist, sleutel, kleur),
  });
}

/** Zet dezelfde kleur voor meerdere leerlingen op een deelevaluatie (één opslagbeurt). */
export function setDeelKleurBulk(
  deelevaluatieId: string,
  studentIds: string[],
  kleur: Rating | null,
) {
  if (deelevaluatieVergrendeld(deelevaluatieId)) return;
  const deelKleuren = { ...state.deelKleuren };
  const info = kleur !== null ? deelMeldingInfo(deelevaluatieId) : null;
  let meldingen = state.meldingen;
  let gewist = state.gewist;
  for (const studentId of studentIds) {
    const sleutel = deelSleutel(deelevaluatieId, studentId);
    const verandert = kleur !== null && deelKleuren[sleutel] !== kleur;
    if (kleur) deelKleuren[sleutel] = kleur;
    else delete deelKleuren[sleutel];
    gewist = pasGewistAan(gewist, sleutel, kleur);
    if (verandert && info) meldingen = metMelding(meldingen, { studentId, ...info });
  }
  commit({ ...state, deelKleuren, meldingen, gewist });
}

/** Wis alle lokale aanpassingen en ga terug naar de seed-data. */
export function resetStore() {
  commit(seed());
}
