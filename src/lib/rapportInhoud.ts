import { cursussenVoorStroom } from "./curriculum";
import { leerjaarInSchooljaar, stroomVan } from "./leerlingen";
import { KLEUR_KEY, rubriekenVoorCursus } from "./rubrieken";
import { getRapportCursusKleur, getRapportCursusOpmerking, getRapportItem } from "./store";
import type { Cursus, Rapport, Rating, Rubriek, Student } from "./types";

export interface RapportRij {
  rubriek: Rubriek;
  kleur: Rating;
  /** De rubric-tekst bij de gekozen kleur — enkel de 4 kleuren hebben er een. "" = geen. */
  betekenis: string;
}

export interface RapportCursus {
  cursus: Cursus;
  kleur: Rating | null;
  opmerking: string;
  rijen: RapportRij[];
}

/**
 * Wat er op het afgedrukte rapport staat, per cursus (`RapportPrint` — ook de bron van de pdf,
 * die de server van dezelfde printweergave maakt).
 *
 * Per cursus enkel de rubrics die effectief een kleur hebben — een lege rubric staat er niet bij
 * (ballast op een rapport dat de deur uit gaat; op het scherm blijven ze wel staan). Een cursus
 * komt op het blad zodra er iets ingevuld is: een rubric-kleur, de cursuskleur of -opmerking.
 */
export function rapportCursussen(
  student: Student,
  rapport: Rapport,
  /** `rubriekenLijst()` — bundel + overrides, dezelfde bron als de Rubrics-pagina. */
  rubrieken: Rubriek[],
): RapportCursus[] {
  const stroom = stroomVan(student, rapport.schooljaar);
  return cursussenVoorStroom(stroom)
    .map((cursus) => ({
      cursus,
      kleur: getRapportCursusKleur(rapport, cursus.id).kleur,
      opmerking: getRapportCursusOpmerking(rapport, cursus.id),
      rijen: rubriekenVoorCursus(rubrieken, stroom, cursus.naam, cursus.id).flatMap((r) => {
        const kleur = getRapportItem(rapport, r.id).kleur;
        if (kleur === null) return [];
        const sleutel = kleur in KLEUR_KEY ? KLEUR_KEY[kleur as keyof typeof KLEUR_KEY] : null;
        return [{ rubriek: r, kleur, betekenis: sleutel ? r.criteria[sleutel] || "" : "" }];
      }),
    }))
    .filter(({ kleur, opmerking, rijen }) => kleur || opmerking || rijen.length > 0);
}

/**
 * De klas op het rapport: leerjaar + klasgroep, bv. "2A" of "4B" — het leerjaar in het schooljaar
 * van het rapport (een rapport van vorig jaar toont de klas van toen).
 */
export const rapportKlas = (student: Student, rapport: Rapport): string =>
  `${leerjaarInSchooljaar(student, rapport.schooljaar)}${student.klasgroep}`;

const veilig = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim();

/**
 * Bestandsnaam zonder extensie: "naamRapport-vestiging-schooljaar-VoornaamNaam" (bv.
 * "Rapport 1-Gent-2026-2027-EmmaJanssens") — Arno's afgesproken patroon.
 */
export function rapportBestandsnaam(rapport: Rapport, student: Student): string {
  const naamRapport = veilig(rapport.naam) || "Rapport";
  const vestiging = veilig(student.vestiging) || "onbekend";
  const leerling = veilig(`${student.firstName}${student.lastName}`) || "leerling";
  return `${naamRapport}-${vestiging}-${rapport.schooljaar}-${leerling}`;
}
