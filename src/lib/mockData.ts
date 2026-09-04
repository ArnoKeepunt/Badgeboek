import {
  cursussenVoorStroom,
  leerdoelenVoorCursus,
  leerdoelenVoorStroom,
  rubricsVoorCursus,
} from "./curriculum";
import { stroomVan } from "./leerlingen";
import { seedLeerlingen, seedMentoren } from "./seedGebruikers";
import type {
  DeelKleuren,
  Deelevaluatie,
  DoelKleuren,
  Melding,
  Mentor,
  Rating,
  Student,
} from "./types";
import { deelSleutel, doelSleutel } from "./types";

const HUIDIG = "2026-2027";

/** Seed-data uit de fictieve-gebruikerslijst. Vervangbaar via CSV-import op /gegevens. */
export const students: Student[] = seedLeerlingen;
export const mentoren: Mentor[] = seedMentoren;

/** Deterministische "hash" van een string → niet-negatief getal. */
const hash = (s: string): number =>
  [...s].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);

/** Deterministische kleur voor een ingevulde cel. */
function seedKleur(bron: string): Rating {
  switch (hash(bron) % 5) {
    case 0:
      return "red";
    case 1:
      return "yellow";
    case 2:
    case 3:
      return "green";
    default:
      return "blue";
  }
}

/**
 * Per schooljaar: de kans dat een badge al een kleur heeft. Enkel de eerste leerlingen krijgen
 * seed-kleuren — anders wordt localStorage te groot.
 */
const SEED_CONFIG: Record<string, number> = {
  "2024-2025": 0.85,
  "2025-2026": 0.6,
  "2026-2027": 0.5,
};

/** Kans dat een cursus- of rubric-graadsbadge al gezet is (lager dan de losse badges). */
const PARENT_DICHTHEID = 0.3;

const GESEEDE_LEERLINGEN = students.slice(0, 16);

/** De badges van elke geseede leerling, volgens zijn/haar eigen stroom (1A, 1B, 2A, 3A). */
const DOELEN_PER_LEERLING = new Map(
  GESEEDE_LEERLINGEN.map((s) => [s.id, leerdoelenVoorStroom(stroomVan(s))]),
);

export const doelKleuren: DoelKleuren = (() => {
  const map: DoelKleuren = {};
  const misschien = (bron: string, dichtheid: number) =>
    (hash(`${bron}#fill`) % 100) / 100 < dichtheid;

  for (const [schooljaar, dichtheid] of Object.entries(SEED_CONFIG)) {
    for (const student of GESEEDE_LEERLINGEN) {
      // Losse badges (leerdoelen).
      for (const doel of DOELEN_PER_LEERLING.get(student.id) ?? []) {
        const bron = `${schooljaar}:${student.id}:${doel.id}`;
        if (misschien(bron, dichtheid)) map[doelSleutel(schooljaar, student.id, doel.id)] = seedKleur(bron);
      }
      // Graadsbadges op cursus- en rubric-niveau.
      for (const cursus of cursussenVoorStroom(stroomVan(student))) {
        const cBron = `${schooljaar}:${student.id}:${cursus.id}`;
        if (misschien(cBron, PARENT_DICHTHEID)) {
          map[doelSleutel(schooljaar, student.id, cursus.id)] = seedKleur(cBron);
        }
        for (const rubric of rubricsVoorCursus(cursus.id)) {
          const rBron = `${schooljaar}:${student.id}:${rubric.id}`;
          if (misschien(rBron, PARENT_DICHTHEID)) {
            map[doelSleutel(schooljaar, student.id, rubric.id)] = seedKleur(rBron);
          }
        }
      }
    }
  }
  return map;
})();

// --- Deelevaluaties (voorbeelden) ----------------------------------------------

// Vaste type-id's uit deelevaluatieTypes.ts (kapstok 1A). Hier hard gezet zodat de seed de
// volledige typelijst niet in de hoofdbundel trekt — die laadt met de Deelevaluaties-pagina.
const TYPE_COACHINGGESPREK = "det-1A-1";
const TYPE_ACTUARONDE_NL = "det-1A-23";

/** Eerste paar badges van een badge-cursus (op naam), om een voorbeeld te koppelen. */
const badgesVan = (cursusNaam: string, n: number): string[] => {
  const c = cursussenVoorStroom("1A").find(
    (x) => x.naam.toLowerCase() === cursusNaam.toLowerCase(),
  );
  return c ? leerdoelenVoorCursus(c.id).slice(0, n).map((d) => d.id) : [];
};

export const seedDeelevaluaties: Deelevaluatie[] = [
  {
    id: "seed-de-1",
    schooljaar: HUIDIG,
    stroom: "1A",
    cursus: "Planning en reflectie",
    typeId: TYPE_COACHINGGESPREK,
    titel: "Coachinggesprek 1 — startgesprek",
    datum: "2026-09-18",
    leerdoelIds: badgesVan("Planning en reflectie", 2),
    toelichting: "Kort individueel gesprek over doelen en planning voor dit trimester.",
  },
  {
    id: "seed-de-2",
    schooljaar: HUIDIG,
    stroom: "1A",
    cursus: "Actuaronde",
    typeId: TYPE_ACTUARONDE_NL,
    titel: "Actuaronde — verkiezingen VS",
    datum: "2026-10-14",
    leerdoelIds: badgesVan("Actua", 2),
    toelichting: "",
  },
  {
    id: "seed-de-3",
    schooljaar: HUIDIG,
    stroom: "1A",
    cursus: "Levende Wiskunde",
    typeId: null,
    titel: "Toets breuken en kommagetallen",
    datum: "2026-11-20",
    leerdoelIds: badgesVan("Levende Wiskunde", 3),
    toelichting: "Schriftelijke toets. Telt mee voor het onderdeel getallenleer.",
  },
];

export const deelKleuren: DeelKleuren = (() => {
  const map: DeelKleuren = {};
  const leerlingen1A = GESEEDE_LEERLINGEN.filter((s) => stroomVan(s) === "1A");
  for (const de of seedDeelevaluaties) {
    for (const s of leerlingen1A) {
      const bron = `${de.id}:${s.id}`;
      if ((hash(`${bron}#fill`) % 100) / 100 < 0.7) {
        map[deelSleutel(de.id, s.id)] = seedKleur(bron);
      }
    }
  }
  return map;
})();

// --- Meldingen (voorbeelden voor het leerling-meldingencentrum) ----------------

export const seedMeldingen: Melding[] = (() => {
  const U = 3_600_000;
  const nu = Date.now();
  const ll = GESEEDE_LEERLINGEN.filter((s) => stroomVan(s) === "1A");
  const cursussen1A = cursussenVoorStroom("1A");
  const cursus = (naam: string) => cursussen1A.find((c) => c.naam === naam);
  const rijen: [naam: string, llIdx: number, aantal: number, urenGeleden: number][] = [
    ["Vrije tekst", 0, 2, 3],
    ["Actua", 0, 1, 27],
    ["Onderzoek", 1, 4, 52],
    ["Levende Wiskunde", 2, 1, 6],
  ];
  return rijen.flatMap(([naam, llIdx, aantal, uren], i) => {
    const s = ll[llIdx];
    const c = cursus(naam);
    if (!s || !c) return [];
    return [
      {
        id: `seed-m${i}`,
        ts: nu - uren * U,
        studentId: s.id,
        soort: "kleur" as const,
        cursusId: c.id,
        cursusNaam: c.naam,
        aantal,
      },
    ];
  });
})();
