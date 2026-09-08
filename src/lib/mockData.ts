import {
  cursussenVoorStroom,
  leerdoelenVoorCursus,
  leerdoelenVoorStroom,
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
import { STROMEN, deelSleutel, doelSleutel } from "./types";

const HUIDIG = "2026-2027";
const [JAAR1, JAAR2] = HUIDIG.split("-");

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
    }
  }
  return map;
})();

// --- Deelevaluaties (voorbeelden) ----------------------------------------------

/** Eerste paar badges van een badge-cursus (op naam), om een voorbeeld te koppelen. */
const badgesVan = (cursusNaam: string, n: number): string[] => {
  const c = cursussenVoorStroom("1A").find(
    (x) => x.naam.toLowerCase() === cursusNaam.toLowerCase(),
  );
  return c ? leerdoelenVoorCursus(c.id).slice(0, n).map((d) => d.id) : [];
};

const voorbeeldDeelevaluaties1A: Deelevaluatie[] = [
  {
    id: "seed-de-1",
    schooljaar: HUIDIG,
    stroom: "1A",
    cursus: "Planning en reflectie",
    typeId: null,
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
    typeId: null,
    titel: "Actuaronde — verkiezingen VS",
    datum: "2026-10-14",
    leerdoelIds: badgesVan("Actuaronde", 2),
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

/**
 * Voorbeeld-deelevaluaties voor élke graad, zodat de koppeling badges ↔ deelevaluaties meteen
 * iets te tonen heeft. Bewust beperkt: enkel de eerste cursus van elke stroom en zijn eerste
 * twee badges, met telkens een handvol deelevaluaties (elk gekoppeld aan één of beide badges).
 */
const perGraadDeelevaluaties: Deelevaluatie[] = STROMEN.flatMap((stroom) => {
  const cursus = cursussenVoorStroom(stroom)[0];
  if (!cursus) return [];
  const badges = leerdoelenVoorCursus(cursus.id)
    .slice(0, 2)
    .map((d) => d.id);
  if (badges.length === 0) return [];
  const b1 = badges[0];
  const b2 = badges[1] ?? badges[0];

  const rijen: { titel: string; datum: string; doelen: string[]; toelichting: string }[] = [
    { titel: "Startopdracht", datum: `${JAAR1}-09-24`, doelen: [b1], toelichting: "" },
    {
      titel: "Tussentoets",
      datum: `${JAAR1}-11-06`,
      doelen: [b1, b2],
      toelichting: "Schriftelijke tussentijdse toets.",
    },
    { titel: "Werkstuk", datum: `${JAAR2}-01-22`, doelen: [b2], toelichting: "" },
    { titel: "Eindpresentatie", datum: `${JAAR2}-03-11`, doelen: [b1, b2], toelichting: "" },
  ];

  return rijen.map((r, i) => ({
    id: `seed-de-${stroom}-${i + 1}`,
    schooljaar: HUIDIG,
    stroom,
    cursus: cursus.naam,
    typeId: null,
    titel: `${cursus.naam} — ${r.titel}`,
    datum: r.datum,
    leerdoelIds: [...new Set(r.doelen)],
    toelichting: r.toelichting,
  }));
});

export const seedDeelevaluaties: Deelevaluatie[] = [
  ...voorbeeldDeelevaluaties1A,
  ...perGraadDeelevaluaties,
];

export const deelKleuren: DeelKleuren = (() => {
  const map: DeelKleuren = {};
  for (const de of seedDeelevaluaties) {
    const leerlingen = GESEEDE_LEERLINGEN.filter((s) => stroomVan(s) === de.stroom);
    for (const s of leerlingen) {
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
    ["Vrije Tekst", 0, 2, 3],
    ["Actuaronde", 0, 1, 27],
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
