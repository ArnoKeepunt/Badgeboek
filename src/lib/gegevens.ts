import { cursussen, leerdoelen, rubrics } from "./curriculum";
import { kopIndex, parseCsv, toCsv } from "./csv";
import type { DoelSoort, Minimumdoel } from "./minimumdoelen";
import { STROMEN } from "./types";
import { periodeLabel } from "./periode";
import { RATING_LABEL } from "./ratings";
import type { DoelKleuren, Mentor, Rating, Stroom, Student } from "./types";

/**
 * Domeinspecifieke CSV-im/export. Geen backend: alles gebeurt in de browser.
 * De sleutel voor leerlingen is hun `id` — die blijft stabiel bij klaswissels,
 * naamscorrecties en jaarovergang, zodat evaluaties niet losraken.
 */

// --- Leerlingen ------------------------------------------------------------

const LEERLING_KOP = ["id", "voornaam", "achternaam", "vestiging", "leerjaar", "klasgroep"];

export function exportLeerlingen(studenten: Student[]): string {
  return toCsv([
    LEERLING_KOP,
    ...studenten.map((s) => [
      s.id,
      s.firstName,
      s.lastName,
      s.vestiging,
      s.leerjaar,
      s.klasgroep,
    ]),
  ]);
}

export interface ImportResultaat<T> {
  rijen: T[];
  fouten: string[];
}

// --- Gebruikers (leerlingen + mentoren) ---------------------------------

/** "4A" → { leerjaar: 4, klasgroep: "A" }; "3" → { 3, "A" }. */
function splitsLeerjaar(waarde: string): { leerjaar: number; klasgroep: string } {
  const m = waarde.trim().match(/^(\d)\s*([A-Za-z]?)/);
  return {
    leerjaar: m ? parseInt(m[1], 10) : 1,
    klasgroep: m && m[2] ? m[2].toUpperCase() : "A",
  };
}

export interface GebruikersImport {
  leerlingen: Student[];
  mentoren: Mentor[];
  fouten: string[];
}

/** Leest de fictieve-gebruikerslijst (kolom `basisrol`) in tot leerlingen + mentoren. */
export function importGebruikers(csv: string): GebruikersImport {
  const rijen = parseCsv(csv);
  if (rijen.length < 2) return { leerlingen: [], mentoren: [], fouten: ["Geen datarijen gevonden."] };

  const k = kopIndex(rijen[0]);
  const kol = (namen: string[]): number => {
    for (const n of namen) if (n in k) return k[n];
    return -1;
  };
  const iGn = kol(["gebruikersnaam", "username", "id"]);
  const iVn = kol(["voornaam", "firstname"]);
  const iNaam = kol(["naam", "achternaam", "lastname"]);
  const iRol = kol(["basisrol", "rol", "role"]);
  const iVest = kol(["vestiging", "campus"]);
  const iJaar = kol(["leerjaar", "jaar", "klas", "grade"]);
  const iMail = kol(["e-mail", "email", "mail"]);
  const iWw = kol(["wachtwoord", "password"]);

  if (iVn < 0 || iNaam < 0 || iRol < 0) {
    return {
      leerlingen: [],
      mentoren: [],
      fouten: ["Kolommen 'voornaam', 'naam' en 'basisrol' zijn verplicht."],
    };
  }

  const leerlingen: Student[] = [];
  const mentoren: Mentor[] = [];
  const fouten: string[] = [];
  const gezien = new Set<string>();

  rijen.slice(1).forEach((r, idx) => {
    const nr = idx + 2;
    const voornaam = (r[iVn] ?? "").trim();
    const naam = (r[iNaam] ?? "").trim();
    const rol = (r[iRol] ?? "").trim().toLowerCase();
    if (!voornaam || !naam) {
      fouten.push(`Rij ${nr}: voornaam of naam ontbreekt — overgeslagen.`);
      return;
    }
    let id = iGn >= 0 ? (r[iGn] ?? "").trim() : "";
    if (!id) id = `${voornaam}.${naam}`.toLowerCase().replace(/[^a-z0-9.]+/g, ".");
    if (gezien.has(id)) {
      fouten.push(`Rij ${nr}: dubbele gebruikersnaam "${id}" — overgeslagen.`);
      return;
    }
    gezien.add(id);
    const vestiging = iVest >= 0 ? (r[iVest] ?? "").trim() : "";
    const email = iMail >= 0 ? (r[iMail] ?? "").trim() : undefined;
    const wachtwoord = iWw >= 0 ? (r[iWw] ?? "").trim() || undefined : undefined;

    if (rol === "mentor" || rol === "leerkracht") {
      mentoren.push({ id, voornaam, naam, vestiging, email, wachtwoord });
    } else {
      const { leerjaar, klasgroep } = splitsLeerjaar(iJaar >= 0 ? (r[iJaar] ?? "") : "");
      leerlingen.push({
        id,
        firstName: voornaam,
        lastName: naam,
        vestiging,
        leerjaar,
        klasgroep,
        email,
        wachtwoord,
      });
    }
  });
  return { leerlingen, mentoren, fouten };
}

export function importLeerlingen(csv: string): ImportResultaat<Student> {
  const rijen = parseCsv(csv);
  const fouten: string[] = [];
  if (rijen.length < 2) return { rijen: [], fouten: ["Geen datarijen gevonden."] };

  const k = kopIndex(rijen[0]);
  const kol = (namen: string[]): number => {
    for (const n of namen) if (n in k) return k[n];
    return -1;
  };
  const iVn = kol(["voornaam", "firstname", "first name"]);
  const iAn = kol(["achternaam", "lastname", "last name", "naam"]);
  const iId = kol(["id", "sourcedid", "source id", "leerling_id"]);
  const iVest = kol(["vestiging", "campus", "school"]);
  const iJaar = kol(["leerjaar", "jaar", "grade"]);
  const iGroep = kol(["klasgroep", "groep", "klas", "class"]);

  if (iVn < 0 || iAn < 0) {
    return { rijen: [], fouten: ["Kolommen 'voornaam' en 'achternaam' zijn verplicht."] };
  }

  const studenten: Student[] = [];
  const gezien = new Set<string>();
  rijen.slice(1).forEach((r, idx) => {
    const nr = idx + 2;
    const voornaam = (r[iVn] ?? "").trim();
    const achternaam = (r[iAn] ?? "").trim();
    if (!voornaam || !achternaam) {
      fouten.push(`Rij ${nr}: voornaam of achternaam ontbreekt — overgeslagen.`);
      return;
    }
    let id = iId >= 0 ? (r[iId] ?? "").trim() : "";
    if (!id) id = `imp-${voornaam}-${achternaam}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    if (gezien.has(id)) {
      fouten.push(`Rij ${nr}: dubbele id "${id}" — overgeslagen.`);
      return;
    }
    gezien.add(id);
    const leerjaar = iJaar >= 0 ? parseInt((r[iJaar] ?? "").trim(), 10) : NaN;
    studenten.push({
      id,
      firstName: voornaam,
      lastName: achternaam,
      vestiging: iVest >= 0 ? (r[iVest] ?? "").trim() : "",
      leerjaar: Number.isFinite(leerjaar) ? leerjaar : 1,
      klasgroep: iGroep >= 0 ? (r[iGroep] ?? "").trim().toUpperCase() : "A",
    });
  });
  return { rijen: studenten, fouten };
}

// --- Evaluaties (back-up) -------------------------------------------------

const EVAL_KOP = [
  "schooljaar",
  "periode",
  "leerling_id",
  "voornaam",
  "achternaam",
  "stroom",
  "cursus",
  "rubric",
  "badge",
  "kleur",
  "behaald",
];

/** Elke ingevulde evaluatie als één rij — de "download op elk moment"-back-up. */
export function exportEvaluaties(studenten: Student[], kleuren: DoelKleuren): string {
  const studById = new Map(studenten.map((s) => [s.id, s]));
  const doelById = new Map(leerdoelen.map((d) => [d.id, d]));
  const rubById = new Map(rubrics.map((r) => [r.id, r]));
  const curById = new Map(cursussen.map((c) => [c.id, c]));

  const rijen: (string | number)[][] = [EVAL_KOP];
  for (const [sleutel, kleur] of Object.entries(kleuren)) {
    const [schooljaar, periode, studentId, leerdoelId] = sleutel.split(":");
    const s = studById.get(studentId);
    const d = doelById.get(leerdoelId);
    const rubriek = d ? rubById.get(d.rubricId) : undefined;
    const cursus = rubriek ? curById.get(rubriek.cursusId) : undefined;
    rijen.push([
      schooljaar,
      periodeLabel(periode),
      studentId,
      s?.firstName ?? "",
      s?.lastName ?? "",
      cursus?.stroom ?? "",
      cursus?.naam ?? "",
      rubriek?.naam ?? "",
      d?.omschrijving ?? leerdoelId,
      RATING_LABEL[kleur as Rating],
      kleur === "green" || kleur === "blue" ? "ja" : "nee",
    ]);
  }
  return toCsv(rijen);
}

// --- Doelen (minimumdoelen / eindtermen) --------------------------------

const DOEL_KOP = [
  "code",
  "stroom",
  "competentie_nr",
  "competentie",
  "nummer",
  "soort",
  "omschrijving",
  "uitleg",
  "opmerking",
];

export function exportDoelen(doelen: Minimumdoel[]): string {
  return toCsv([
    DOEL_KOP,
    ...doelen.map((d) => [
      d.code,
      d.stroom,
      d.competentieNr,
      d.competentie,
      d.nummer,
      d.soort,
      d.omschrijving,
      d.uitleg,
      d.opmerking ?? "",
    ]),
  ]);
}

const SOORT_ALIAS: Record<string, DoelSoort> = {
  standaard: "standaard",
  standaarddoel: "standaard",
  st: "standaard",
  basisgeletterdheid: "basisgeletterdheid",
  bg: "basisgeletterdheid",
  uitbreiding: "uitbreiding",
  ub: "uitbreiding",
  u: "uitbreiding",
  freinet: "freinet",
  f: "freinet",
};

export function importDoelen(csv: string): ImportResultaat<Minimumdoel> {
  const rijen = parseCsv(csv);
  const fouten: string[] = [];
  if (rijen.length < 2) return { rijen: [], fouten: ["Geen datarijen gevonden."] };

  const k = kopIndex(rijen[0]);
  const kol = (namen: string[]): number => {
    for (const n of namen) if (n in k) return k[n];
    return -1;
  };
  const iCode = kol(["code", "sleutel", "sleutel (unieke code)"]);
  const iOms = kol(["omschrijving", "de korte omschrijving van het minimumdoel", "minimumdoel"]);
  const iStroom = kol(["stroom", "graad", "graad/stroom"]);
  const iComp = kol(["competentie", "naam van de sleutelcompetentie", "sleutelcompetentie"]);
  const iNr = kol(["nummer", "nummer van het doel"]);
  const iSoort = kol(["soort", "soort doel"]);
  const iUitleg = kol(["uitleg", "verdere uitleg bij het minimumdoel", "verdere uitleg"]);
  const iOpm = kol(["opmerking", "opmerkingen", "opmerkingen / mogelijke fouten"]);

  if (iCode < 0 || iOms < 0) {
    return { rijen: [], fouten: ["Kolommen 'code' en 'omschrijving' zijn verplicht."] };
  }

  const doelen: Minimumdoel[] = [];
  const gezien = new Set<string>();
  rijen.slice(1).forEach((r, idx) => {
    const nr = idx + 2;
    const code = (r[iCode] ?? "").trim();
    const omschrijving = (r[iOms] ?? "").trim();
    if (!code || !omschrijving) {
      fouten.push(`Rij ${nr}: code of omschrijving ontbreekt — overgeslagen.`);
      return;
    }
    if (gezien.has(code)) {
      fouten.push(`Rij ${nr}: dubbele code "${code}" — overgeslagen.`);
      return;
    }
    gezien.add(code);

    let stroom = (iStroom >= 0 ? (r[iStroom] ?? "") : "").trim().toUpperCase() as Stroom;
    if (!(STROMEN as string[]).includes(stroom)) {
      const uitCode = code.split(".")[0].toUpperCase();
      stroom = ((STROMEN as string[]).includes(uitCode) ? uitCode : "1A") as Stroom;
    }
    const competentie = (iComp >= 0 ? (r[iComp] ?? "") : "").trim();
    const compMatch = competentie.match(/^\s*(\d+)/);
    const soortRuw = (iSoort >= 0 ? (r[iSoort] ?? "") : "").trim().toLowerCase();
    doelen.push({
      code,
      stroom,
      competentieNr: compMatch ? parseInt(compMatch[1], 10) : 0,
      competentie: competentie || "Overige",
      nummer: (iNr >= 0 ? (r[iNr] ?? "") : "").trim(),
      soort: SOORT_ALIAS[soortRuw] ?? "standaard",
      omschrijving,
      uitleg: (iUitleg >= 0 ? (r[iUitleg] ?? "") : "").trim(),
      opmerking: (iOpm >= 0 ? (r[iOpm] ?? "").trim() : "") || undefined,
    });
  });
  return { rijen: doelen, fouten };
}
