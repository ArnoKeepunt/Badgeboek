import { useSyncExternalStore } from "react";
import {
  GEBUNDELD,
  GEBUNDELD_RUW,
  alleCursussen,
  alleLeerdoelen,
  type CurriculumRuw,
  cursusVanLeerdoel,
  cursusVanNode,
  zetCurriculum,
} from "./curriculum";
import { type PersistedStore, type RauweStore, maakPersistentie, sessieOpslag } from "./data";
import {
  deelKleuren as seedDeelKleuren,
  seedDeelevaluaties,
  doelKleuren as seedKleuren,
  seedMeldingen,
  mentoren as seedMentoren,
  students as seedStudents,
} from "./mockData";
import type { Minimumdoel } from "./minimumdoelen";
import { HUIDIG_SCHOOLJAAR, isAfgesloten } from "./schooljaar";
import type {
  AuditLog,
  AuditRegel,
  Basisrol,
  DeelKleuren,
  DeelNotities,
  Deelevaluatie,
  DoelKleuren,
  Groep,
  Melding,
  Mentor,
  Notitie,
  Notities,
  Rating,
  Rubriek,
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
 * In-memory reactieve store: elke mutatie vervangt `state` door een nieuw object zodat
 * `useSyncExternalStore` de abonnees opnieuw rendert. Hier zitten de domeinregels (seed
 * eronder mergen, meldingen, `gewist`, afgesloten-schooljaar-guards).
 *
 * Waar de data *fysiek* leeft weet deze module niet: dat gaat via een `BadgeboekPersistentie`
 * (`src/lib/data/`). Nu localStorage, later Firebase/Supabase — zonder wijziging aan de pagina's.
 */

const opslag = maakPersistentie();

/**
 * De volledige store = alles wat bewaard wordt (`PersistedStore`, veldbeschrijvingen staan in
 * `src/lib/data/persistentie.ts`) + de per-tab `sessie` die buiten de gedeelde opslag leeft.
 */
interface State extends PersistedStore {
  /** Wie er is aangemeld (per browsertab). */
  sessie: Sessie | null;
}

const MAX_MELDINGEN = 120;
const MAX_GEWIST = 1000;

/** De seed-/demodata. Dit is de `PersistedStore`, dus zonder `sessie`. */
const seed = (): PersistedStore => ({
  students: seedStudents,
  mentoren: seedMentoren,
  kleuren: seedKleuren,
  notities: {},
  groepen: [],
  schooljaar: HUIDIG_SCHOOLJAAR,
  matrixStromen: ["1A"],
  matrixCursus: "",
  doelWijzigingen: {},
  doelenImport: null,
  rubriekWijzigingen: {},
  curriculumOverride: null,
  deelevaluaties: seedDeelevaluaties,
  deelKleuren: seedDeelKleuren,
  deelNotities: {},
  auditLog: {},
  meldingen: seedMeldingen,
  meldingGezien: {},
  gewist: [],
});

/**
 * De ruwe (mogelijk onvolledige/oude) opslag samenvoegen met de seed-data + migraties.
 * Levert de `PersistedStore` (zonder `sessie`, die komt er los bij).
 */
function verwerkRauw(bewaard: RauweStore | null): PersistedStore {
  const standaard = seed();
  if (!bewaard) return standaard;

  const basis: PersistedStore = { ...standaard, ...bewaard };
  // De seed-evaluaties en -notities blijven onder de bewaarde waarden liggen: zo verschijnt
  // nieuwe demo-data (bv. voor 1B/2A/3A-leerlingen) zonder dat een eigen kleur of notitie
  // sneuvelt — een handmatige waarde wint altijd van de seed.
  basis.kleuren = { ...standaard.kleuren, ...(bewaard.kleuren ?? {}) };
  basis.notities = { ...standaard.notities, ...(bewaard.notities ?? {}) };
  basis.deelKleuren = { ...standaard.deelKleuren, ...(bewaard.deelKleuren ?? {}) };
  basis.deelNotities = { ...standaard.deelNotities, ...(bewaard.deelNotities ?? {}) };
  // Wijzigingsgeschiedenis: de seed heeft er geen, dus gewoon de bewaarde overnemen.
  basis.auditLog = { ...(bewaard.auditLog ?? {}) };
  // Bewust gewiste kleuren blijven weg, ook al zit er seed-data onder.
  basis.gewist = Array.isArray(bewaard.gewist) ? bewaard.gewist : [];
  for (const k of basis.gewist) {
    delete basis.kleuren[k];
    delete basis.deelKleuren[k];
  }
  // De voorbeeld-deelevaluaties/-meldingen blijven staan tot er echte data is. Nieuwe seed-
  // deelevaluaties (bv. per graad) schuiven onder de bewaarde: aangemaakte/gewijzigde blijven,
  // ontbrekende seed-rijen komen erbij (op id).
  if (Array.isArray(bewaard.deelevaluaties)) {
    const aanwezig = new Set(bewaard.deelevaluaties.map((d) => d.id));
    basis.deelevaluaties = [
      ...bewaard.deelevaluaties,
      ...standaard.deelevaluaties.filter((d) => !aanwezig.has(d.id)),
    ];
  } else {
    basis.deelevaluaties = standaard.deelevaluaties;
  }
  if (!Array.isArray(bewaard.meldingen)) basis.meldingen = standaard.meldingen;
  if (!bewaard.meldingGezien) basis.meldingGezien = standaard.meldingGezien;
  // Migratie: vroeger één stroom (`matrixStroom`), nu een lijst (`matrixStromen`).
  if (!Array.isArray(bewaard.matrixStromen)) {
    basis.matrixStromen = bewaard.matrixStroom ? [bewaard.matrixStroom] : standaard.matrixStromen;
  }
  // De database-versie van de badges (alleen door de beheerder bewerkbaar, `null` = de bundel).
  basis.curriculumOverride = geldigCurriculum(bewaard.curriculumOverride) ?? null;
  zetCurriculum(basis.curriculumOverride);
  schoonOrphans(basis);
  return basis;
}

/** Snelle vormcontrole zodat een kapotte database-versie de app niet breekt (val terug op de bundel). */
export function geldigCurriculum(d: unknown): CurriculumRuw | null {
  if (!d || typeof d !== "object") return null;
  const c = d as Partial<CurriculumRuw>;
  return Array.isArray(c.cursussen) &&
    Array.isArray(c.badges) &&
    c.cursussen.length > 0 &&
    c.badges.length > 0
    ? (c as CurriculumRuw)
    : null;
}

/**
 * Opkuis-migratie. Sinds de badges herwerkt zijn uit `deelevaluaties_alle-graden-2.xlsx`
 * (cursus "Basisvaardigheden" weg, geen cursus-/rubric-/subgroep-graadsbadges meer, badge-ids
 * hernummerd) wijzen oude opgeslagen sleutels naar badges die niet meer bestaan. Die worden
 * hier weggegooid. Idempotent — draait bij elke load.
 */
function schoonOrphans(basis: PersistedStore): void {
  // Geldig = in de bundel OF in de database-versie. Zo wist het verwijderen van een badge uit
  // de database níét meteen alle evaluaties ervan (die komen terug als de badge weer opduikt);
  // enkel wat in geen van beide zit (bv. de oude Basisvaardigheden-badges) wordt opgekuist.
  const geldigeBadges = new Set([
    ...GEBUNDELD.leerdoelen.map((l) => l.id),
    ...alleLeerdoelen().map((l) => l.id),
  ]);
  const geldigeCursusIds = new Set([
    ...GEBUNDELD.cursussen.map((c) => c.id),
    ...alleCursussen().map((c) => c.id),
  ]);
  const geldigeCursusNamen = new Set([
    ...GEBUNDELD.cursussen.map((c) => c.naam),
    ...alleCursussen().map((c) => c.naam),
  ]);

  const badgeVanSleutel = (sleutel: string): string => {
    const i1 = sleutel.indexOf(":");
    const i2 = sleutel.indexOf(":", i1 + 1);
    return i2 === -1 ? "" : sleutel.slice(i2 + 1);
  };
  const snoeiKleurMap = <T,>(map: Record<string, T>): Record<string, T> => {
    const uit: Record<string, T> = {};
    for (const [k, v] of Object.entries(map)) {
      if (geldigeBadges.has(badgeVanSleutel(k))) uit[k] = v;
    }
    return uit;
  };

  basis.kleuren = snoeiKleurMap(basis.kleuren);
  basis.notities = snoeiKleurMap(basis.notities);
  // `auditLog` (geschiedenis) blijft ongemoeid: verweesde regels worden nooit getoond.

  basis.deelevaluaties = basis.deelevaluaties.map((d) => ({
    ...d,
    leerdoelIds: d.leerdoelIds.filter((id) => geldigeBadges.has(id)),
  }));
  const deIds = new Set(basis.deelevaluaties.map((d) => d.id));
  const snoeiDeelMap = <T,>(map: Record<string, T>): Record<string, T> => {
    const uit: Record<string, T> = {};
    for (const [k, v] of Object.entries(map)) {
      if (deIds.has(k.slice(0, k.lastIndexOf(":")))) uit[k] = v;
    }
    return uit;
  };
  basis.deelKleuren = snoeiDeelMap(basis.deelKleuren);
  basis.deelNotities = snoeiDeelMap(basis.deelNotities);

  basis.meldingen = basis.meldingen.map((m) =>
    m.cursusId && !geldigeCursusIds.has(m.cursusId) ? { ...m, cursusId: "" } : m,
  );
  if (basis.matrixCursus && !geldigeCursusNamen.has(basis.matrixCursus)) {
    basis.matrixCursus = "";
  }
  basis.gewist = basis.gewist.filter((k) => geldigeBadges.has(badgeVanSleutel(k)));
}

function load(): State {
  let bewaard: RauweStore | null = null;
  try {
    bewaard = opslag.laadDirect();
  } catch {
    // opslag onbereikbaar — terugvallen op de seed
  }
  return { ...verwerkRauw(bewaard), sessie: sessieOpslag.laad() };
}

let state: State = load();
const listeners = new Set<() => void>();

function commit(next: State) {
  state = next;
  zetCurriculum(state.curriculumOverride);
  const { sessie, ...rest } = state;
  void opslag.bewaar(rest);
  sessieOpslag.bewaar(sessie);
  listeners.forEach((notify) => notify());
}

// Data die elders wijzigt (andere browsertab nu, straks een realtime backend) overnemen —
// zonder terug te schrijven, anders krijg je een lus.
opslag.abonneer?.((rauw) => {
  try {
    state = { ...verwerkRauw(rauw), sessie: state.sessie };
    listeners.forEach((notify) => notify());
  } catch {
    // onbruikbare payload van elders — huidige state behouden
  }
});

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

const cursusInfoVoorNode = (nodeId: string) => {
  const c = cursusVanNode(nodeId);
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

// --- Wijzigingsgeschiedenis: wie wijzigde een evaluatiecel (kleur of notitie) wanneer --------

/** De id van wie nu handelt, of "" voor de beheerder(smodus). */
const huidigeGebruiker = (): string => state.sessie?.id ?? "";

/** Ruime bovengrens per cel — de oudste regels vallen weg (het is een demo/prototype). */
const MAX_AUDIT_PER_CEL = 50;

type Wijziging = { sleutel: string; veld: AuditRegel["veld"]; van: string; naar: string };

/** Voeg één of meer geschiedenisregels toe (één tijdstempel voor de hele beurt). */
function metAudit(auditLog: AuditLog, wijzigingen: Wijziging[]): AuditLog {
  if (wijzigingen.length === 0) return auditLog;
  const op = Date.now();
  const door = huidigeGebruiker();
  const next = { ...auditLog };
  for (const w of wijzigingen) {
    const bestaand = next[w.sleutel] ?? [];
    next[w.sleutel] = [...bestaand, { op, door, veld: w.veld, van: w.van, naar: w.naar }].slice(
      -MAX_AUDIT_PER_CEL,
    );
  }
  return next;
}

/** De volledige geschiedenis van een evaluatiecel (oudste eerst), of een lege lijst. */
export function geschiedenisVoor(auditLog: AuditLog, sleutel: string): AuditRegel[] {
  return auditLog[sleutel] ?? [];
}

/** De laatste wijziging van een evaluatiecel, of `null`. */
export function laatsteWijziging(auditLog: AuditLog, sleutel: string): AuditRegel | null {
  const g = auditLog[sleutel];
  return g && g.length > 0 ? g[g.length - 1] : null;
}

/** Korte weergave van een notitie voor de geschiedenis (zichtbare tekst, of "(verborgen)"). */
const notitieWeergave = (n: Notitie): string =>
  n.zichtbaar || (n.verborgen ? "(verborgen notitie)" : "");

/**
 * Zet (of wis, met `null`) de kleur van een badge voor één leerling in een schooljaar.
 * `nodeId` is een leerdoel-id (badge).
 */
export function setDoelKleur(
  schooljaar: string,
  studentId: string,
  nodeId: string,
  kleur: Rating | null,
) {
  // Een afgesloten schooljaar staat vast: negeer wijzigingen.
  if (isAfgesloten(schooljaar)) return;
  const sleutel = doelSleutel(schooljaar, studentId, nodeId);
  const oud = state.kleuren[sleutel] ?? null;
  const gewijzigd = oud !== kleur;
  const verandert = kleur !== null && oud !== kleur;
  const kleuren = { ...state.kleuren };
  if (kleur) kleuren[sleutel] = kleur;
  else delete kleuren[sleutel];
  const meldingen =
    verandert && schooljaar === HUIDIG_SCHOOLJAAR
      ? metMelding(state.meldingen, {
          studentId,
          soort: "kleur",
          ...cursusInfoVoorNode(nodeId),
        })
      : state.meldingen;
  commit({
    ...state,
    kleuren,
    auditLog: gewijzigd
      ? metAudit(state.auditLog, [
          { sleutel, veld: "kleur", van: oud ?? "", naar: kleur ?? "" },
        ])
      : state.auditLog,
    meldingen,
    gewist: pasGewistAan(state.gewist, sleutel, kleur),
  });
}

/** Lees de kleur van een node voor één leerling in een schooljaar (`null` = niet aangeboden). */
export function getDoelKleur(
  kleuren: DoelKleuren,
  schooljaar: string,
  studentId: string,
  nodeId: string,
): Rating | null {
  return kleuren[doelSleutel(schooljaar, studentId, nodeId)] ?? null;
}

/** Zet dezelfde kleur voor meerdere leerlingen tegelijk op één node (één opslagbeurt). */
export function setDoelKleurBulk(
  schooljaar: string,
  studentIds: string[],
  nodeId: string,
  kleur: Rating | null,
) {
  if (isAfgesloten(schooljaar)) return;
  const kleuren = { ...state.kleuren };
  const logt = kleur !== null && schooljaar === HUIDIG_SCHOOLJAAR;
  const cursusInfo = logt ? cursusInfoVoorNode(nodeId) : null;
  let meldingen = state.meldingen;
  let gewist = state.gewist;
  const wijzigingen: Wijziging[] = [];
  for (const studentId of studentIds) {
    const sleutel = doelSleutel(schooljaar, studentId, nodeId);
    const oud = kleuren[sleutel] ?? null;
    if (oud !== kleur) {
      wijzigingen.push({ sleutel, veld: "kleur", van: oud ?? "", naar: kleur ?? "" });
    }
    if (kleur) kleuren[sleutel] = kleur;
    else delete kleuren[sleutel];
    gewist = pasGewistAan(gewist, sleutel, kleur);
    if (kleur !== null && oud !== kleur && cursusInfo) {
      meldingen = metMelding(meldingen, { studentId, soort: "kleur", ...cursusInfo });
    }
  }
  commit({ ...state, kleuren, auditLog: metAudit(state.auditLog, wijzigingen), meldingen, gewist });
}

// --- Notities ------------------------------------------------------------

export function getNotitie(
  notities: Notities,
  schooljaar: string,
  studentId: string,
  nodeId: string,
): Notitie {
  return notities[notitieSleutel(schooljaar, studentId, nodeId)] ?? LEGE_NOTITIE;
}

/** Werk een notitie bij; verdwijnt als beide velden leeg zijn. */
export function zetNotitie(
  schooljaar: string,
  studentId: string,
  nodeId: string,
  patch: Partial<Notitie>,
) {
  if (isAfgesloten(schooljaar)) return;
  const sleutel = notitieSleutel(schooljaar, studentId, nodeId);
  const huidig = state.notities[sleutel] ?? LEGE_NOTITIE;
  const nieuw: Notitie = {
    zichtbaar: (patch.zichtbaar ?? huidig.zichtbaar).trim(),
    verborgen: (patch.verborgen ?? huidig.verborgen).trim(),
  };
  const gewijzigd =
    huidig.zichtbaar !== nieuw.zichtbaar || huidig.verborgen !== nieuw.verborgen;
  const notities = { ...state.notities };
  if (nieuw.zichtbaar || nieuw.verborgen) notities[sleutel] = nieuw;
  else delete notities[sleutel];
  commit({
    ...state,
    notities,
    auditLog: gewijzigd
      ? metAudit(state.auditLog, [
          {
            sleutel,
            veld: "notitie",
            van: notitieWeergave(huidig),
            naar: notitieWeergave(nieuw),
          },
        ])
      : state.auditLog,
  });
}

/** Wissel het bekeken schooljaar. */
export function setSchooljaar(schooljaar: string) {
  commit({ ...state, schooljaar });
}

/** Zet de getoonde stromen van de matrix-pagina's (in vaste volgorde, minstens één). */
export function setMatrixStromen(stromen: Stroom[]) {
  const uniek = STROMEN.filter((s) => stromen.includes(s));
  commit({ ...state, matrixStromen: uniek.length > 0 ? uniek : ["1A"] });
}

/** Zet één stroom aan of uit (de laatste actieve stroom blijft staan). */
export function toggleMatrixStroom(stroom: Stroom) {
  const actief = state.matrixStromen.includes(stroom);
  if (actief && state.matrixStromen.length === 1) return;
  setMatrixStromen(
    actief
      ? state.matrixStromen.filter((s) => s !== stroom)
      : [...state.matrixStromen, stroom],
  );
}

/**
 * Cursusfilter voor de matrix-pagina's (Badges / Deelevaluaties / Rubrics), op cursusnaam.
 * `""` = alle cursussen. Gedeeld zodat de keuze meegaat als je van pagina wisselt.
 */
export function setMatrixCursus(cursus: string) {
  commit({ ...state, matrixCursus: cursus });
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

// --- Curriculum (badges) database-versie --------------------------------

/**
 * Zet (of wis met `null`) de database-versie van de badges (ruwe vorm: cursussen + badges).
 * Alleen de beheerder roept dit aan (via /gegevens). In firebase-modus wordt het naar de
 * `curriculum/{stroom}/cursussen/…/badges/…`-subboom geschreven; daarna bewerkt de beheerder
 * rechtstreeks in de Firestore-console.
 */
export function zetCurriculumOverride(ruw: CurriculumRuw | null) {
  commit({ ...state, curriculumOverride: ruw });
  void opslag.schrijfCurriculum?.(ruw);
}

/** De ingebouwde (gebundelde) badge-set, ruw — bron voor "zet de huidige badges in de database". */
export const gebundeldCurriculum = (): CurriculumRuw => GEBUNDELD_RUW;

// --- Rubrieken -----------------------------------------------------------

/** Bewaar een bewerking aan één uitgeschreven rubric (op basis van zijn id). */
export function wijzigRubriek(id: string, patch: Partial<Omit<Rubriek, "id" | "cursus" | "stroom">>) {
  commit({
    ...state,
    rubriekWijzigingen: {
      ...state.rubriekWijzigingen,
      [id]: { ...state.rubriekWijzigingen[id], ...patch },
    },
  });
}

/** Verwijder alle bewerkingen aan één rubric (terug naar de brontekst). */
export function herstelRubriek(id: string) {
  if (!state.rubriekWijzigingen[id]) return;
  const rest = { ...state.rubriekWijzigingen };
  delete rest[id];
  commit({ ...state, rubriekWijzigingen: rest });
}

// --- Deelevaluaties -------------------------------------------------------

/** Maak een deelevaluatie aan en geef de id terug. */
export function maakDeelevaluatie(
  data: Omit<Deelevaluatie, "id">,
): string {
  const nu = Date.now();
  const id = `de${nu.toString(36)}`;
  const wie = huidigeGebruiker();
  commit({
    ...state,
    deelevaluaties: [
      ...state.deelevaluaties,
      { ...data, id, aangemaaktOp: nu, gewijzigdOp: nu, gewijzigdDoor: wie },
    ],
  });
  return id;
}

/** Wijzig een deelevaluatie (het record zelf — titel/datum/badges/toelichting). */
export function wijzigDeelevaluatie(id: string, patch: Partial<Omit<Deelevaluatie, "id">>) {
  const nu = Date.now();
  const wie = huidigeGebruiker();
  commit({
    ...state,
    deelevaluaties: state.deelevaluaties.map((d) =>
      d.id === id ? { ...d, ...patch, gewijzigdOp: nu, gewijzigdDoor: wie } : d,
    ),
  });
}

/** Verwijder een deelevaluatie én de bijhorende kleuren en notities. */
export function verwijderDeelevaluatie(id: string) {
  const deelKleuren = { ...state.deelKleuren };
  const deelNotities = { ...state.deelNotities };
  for (const sleutel of Object.keys(deelKleuren)) {
    if (sleutel.startsWith(`${id}:`)) delete deelKleuren[sleutel];
  }
  for (const sleutel of Object.keys(deelNotities)) {
    if (sleutel.startsWith(`${id}:`)) delete deelNotities[sleutel];
  }
  commit({
    ...state,
    deelevaluaties: state.deelevaluaties.filter((d) => d.id !== id),
    deelKleuren,
    deelNotities,
  });
}

export function getDeelKleur(
  deelKleuren: DeelKleuren,
  deelevaluatieId: string,
  studentId: string,
): Rating | null {
  return deelKleuren[deelSleutel(deelevaluatieId, studentId)] ?? null;
}

/** De notitie bij één deelevaluatiecel (leeg als er geen is). */
export function getDeelNotitie(
  deelNotities: DeelNotities,
  deelevaluatieId: string,
  studentId: string,
): Notitie {
  return deelNotities[deelSleutel(deelevaluatieId, studentId)] ?? LEGE_NOTITIE;
}

/** Werk de notitie bij één deelevaluatiecel bij; verdwijnt als beide velden leeg zijn. */
export function zetDeelNotitie(
  deelevaluatieId: string,
  studentId: string,
  patch: Partial<Notitie>,
) {
  if (deelevaluatieVergrendeld(deelevaluatieId)) return;
  const sleutel = deelSleutel(deelevaluatieId, studentId);
  const huidig = state.deelNotities[sleutel] ?? LEGE_NOTITIE;
  const nieuw: Notitie = {
    zichtbaar: (patch.zichtbaar ?? huidig.zichtbaar).trim(),
    verborgen: (patch.verborgen ?? huidig.verborgen).trim(),
  };
  const gewijzigd =
    huidig.zichtbaar !== nieuw.zichtbaar || huidig.verborgen !== nieuw.verborgen;
  const deelNotities = { ...state.deelNotities };
  if (nieuw.zichtbaar || nieuw.verborgen) deelNotities[sleutel] = nieuw;
  else delete deelNotities[sleutel];
  commit({
    ...state,
    deelNotities,
    auditLog: gewijzigd
      ? metAudit(state.auditLog, [
          {
            sleutel,
            veld: "notitie",
            van: notitieWeergave(huidig),
            naar: notitieWeergave(nieuw),
          },
        ])
      : state.auditLog,
  });
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
  const oud = deelKleuren[sleutel] ?? null;
  const gewijzigd = oud !== kleur;
  const verandert = kleur !== null && oud !== kleur;
  if (kleur) deelKleuren[sleutel] = kleur;
  else delete deelKleuren[sleutel];
  const info = verandert ? deelMeldingInfo(deelevaluatieId) : null;
  const meldingen = info ? metMelding(state.meldingen, { studentId, ...info }) : state.meldingen;
  commit({
    ...state,
    deelKleuren,
    auditLog: gewijzigd
      ? metAudit(state.auditLog, [
          { sleutel, veld: "kleur", van: oud ?? "", naar: kleur ?? "" },
        ])
      : state.auditLog,
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
  const wijzigingen: Wijziging[] = [];
  for (const studentId of studentIds) {
    const sleutel = deelSleutel(deelevaluatieId, studentId);
    const oud = deelKleuren[sleutel] ?? null;
    if (oud !== kleur) {
      wijzigingen.push({ sleutel, veld: "kleur", van: oud ?? "", naar: kleur ?? "" });
    }
    if (kleur) deelKleuren[sleutel] = kleur;
    else delete deelKleuren[sleutel];
    gewist = pasGewistAan(gewist, sleutel, kleur);
    if (kleur !== null && oud !== kleur && info) {
      meldingen = metMelding(meldingen, { studentId, ...info });
    }
  }
  commit({
    ...state,
    deelKleuren,
    auditLog: metAudit(state.auditLog, wijzigingen),
    meldingen,
    gewist,
  });
}

/** Wis alle lokale aanpassingen en ga terug naar de seed-data (meldt ook af). */
export function resetStore() {
  commit({ ...seed(), sessie: null });
}
