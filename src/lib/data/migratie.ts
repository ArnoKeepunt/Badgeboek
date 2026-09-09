import { HUIDIG_SCHOOLJAAR, SCHOOLJAREN } from "../schooljaar";
import type { Stroom } from "../types";
import { leesDoc, schrijfDocMap, verwijderDocs } from "./firebaseApp";
import { storeNaarDocs } from "./firestoreLayout";
import type { PersistedStore } from "./persistentie";

/**
 * Eenmalige migratie van de oude AI-Studio-structuur (3 gigantische documenten
 * `badgeboek/_globaal`, `badgeboek/{schooljaar}`, `curriculum/actief`) naar de nette
 * collecties. Alleen door de beheerder, via /gegevens.
 */

export interface MigratieResultaat {
  leerlingen: number;
  mentoren: number;
  groepen: number;
  deelbadges: number;
  evaluatieDocs: number;
}

export async function migreerDatabase(): Promise<MigratieResultaat> {
  const globaal = await leesDoc("badgeboek", "_globaal");
  if (!globaal) {
    throw new Error("Geen oud document badgeboek/_globaal gevonden — niets te migreren.");
  }

  const kleuren: Record<string, unknown> = {};
  const notities: Record<string, unknown> = {};
  const deelKleuren: Record<string, unknown> = {};
  const deelNotities: Record<string, unknown> = {};
  const auditLog: Record<string, unknown> = {};
  const gewist: string[] = [];
  for (const sj of SCHOOLJAREN) {
    const ev = await leesDoc("badgeboek", sj);
    if (!ev) continue;
    Object.assign(kleuren, ev.kleuren ?? {});
    Object.assign(notities, ev.notities ?? {});
    Object.assign(deelKleuren, ev.deelKleuren ?? {});
    Object.assign(deelNotities, ev.deelNotities ?? {});
    Object.assign(auditLog, ev.auditLog ?? {});
    if (Array.isArray(ev.gewist)) gewist.push(...(ev.gewist as string[]));
  }

  const store = {
    students: (globaal.students ?? []) as PersistedStore["students"],
    mentoren: (globaal.mentoren ?? []) as PersistedStore["mentoren"],
    groepen: (globaal.groepen ?? []) as PersistedStore["groepen"],
    schooljaar: (globaal.schooljaar as string) ?? HUIDIG_SCHOOLJAAR,
    matrixStromen: (globaal.matrixStromen ?? ["1A"]) as Stroom[],
    matrixCursus: (globaal.matrixCursus as string) ?? "",
    afgeslotenSchooljaren: null,
    doelWijzigingen: (globaal.doelWijzigingen ?? {}) as PersistedStore["doelWijzigingen"],
    doelenImport: (globaal.doelenImport ?? null) as PersistedStore["doelenImport"],
    rubriekWijzigingen: (globaal.rubriekWijzigingen ?? {}) as PersistedStore["rubriekWijzigingen"],
    curriculumOverride: null,
    rubriekenOverride: null,
    vestigingen: null,
    deelevaluaties: (globaal.deelevaluaties ?? []) as PersistedStore["deelevaluaties"],
    deelKleuren: deelKleuren as PersistedStore["deelKleuren"],
    deelNotities: deelNotities as PersistedStore["deelNotities"],
    kleuren: kleuren as PersistedStore["kleuren"],
    notities: notities as PersistedStore["notities"],
    auditLog: auditLog as PersistedStore["auditLog"],
    gewist,
    meldingen: (globaal.meldingen ?? []) as PersistedStore["meldingen"],
    meldingGezien: (globaal.meldingGezien ?? {}) as PersistedStore["meldingGezien"],
  } satisfies PersistedStore;

  const docs = storeNaarDocs(store);
  await schrijfDocMap(docs);

  // Het curriculum wordt NIET meegemigreerd — dat zet je apart met "Zet de ingebouwde badges
  // in de database" (die schrijft meteen de nette subcollectie-structuur).

  return {
    leerlingen: store.students.length,
    mentoren: store.mentoren.length,
    groepen: store.groepen.length,
    deelbadges: store.deelevaluaties.length,
    evaluatieDocs: [...docs.keys()].filter((p) => p.startsWith("evaluaties/")).length,
  };
}

/** De oude documenten wissen ná een gecontroleerde migratie. */
export async function verwijderOudeStructuur(): Promise<void> {
  await verwijderDocs([
    ["badgeboek", "_globaal"],
    ...SCHOOLJAREN.map((sj) => ["badgeboek", sj]),
    ["curriculum", "actief"],
    ["test", "connection"],
  ]);
}
