/** De evaluatiekleuren. `null` = nog niet aangeboden / geëvalueerd (de lege staat). */
export type Rating = 'red' | 'yellow' | 'green' | 'blue'

/**
 * Doelcategorie (zie badgeboek):
 * - `standaard`         : de meeste doelen
 * - `basisgeletterdheid`: moet door elke leerling afzonderlijk behaald worden (BG)
 * - `uitbreiding`       : niet verplicht, voor sterkere leerlingen (U/UB)
 * - `freinet`           : specifiek voor de studierichting Freinetpedagogie (F)
 */
export type DoelCategorie = "standaard" | "basisgeletterdheid" | "uitbreiding" | "freinet";

/** Graad + stroom, zoals de badgeboeken en de eindtermenbestanden. */
export type Stroom = "1A" | "1B" | "2A" | "3A";

export const STROMEN: Stroom[] = ["1A", "1B", "2A", "3A"];

export const STROOM_LABEL: Record<Stroom, string> = {
  "1A": "1e graad A",
  "1B": "1e graad B",
  "2A": "2e graad A",
  "3A": "3e graad",
};

export interface Cursus {
  id: string;
  stroom: Stroom;
  naam: string;
}

/** Bundeling van leerdoelen binnen een cursus (soms 'cluster' genoemd). */
export interface Rubric {
  id: string;
  cursusId: string;
  naam: string;
}

/** Criteria per kleur bij een leerdoel (uit de badgeboek-rubrics). */
export interface Kleurcriteria {
  blauw: string;
  groen: string;
  geel: string;
  rood: string;
}

export interface Leerdoel {
  id: string;
  rubricId: string;
  omschrijving: string;
  categorie: DoelCategorie;
  /** Optioneel: de rubric-omschrijving per kleur. */
  kleuren?: Kleurcriteria;
}

/**
 * Een uitgeschreven rubric (los van de badgematrix): per cursus en stroom, met de doelcodes
 * die eronder vallen, de omschrijving per kleur en een tekst over de leerlijn. Bron:
 * docs/reference/rubrics_overzicht.xlsx → `src/lib/rubriekenData.ts` (auto-gegenereerd).
 * Nog niet alle cursussen zijn uitgeschreven.
 */
export interface Rubriek {
  id: string;
  cursus: string;
  stroom: Stroom;
  naam: string;
  /** Doelcodes uit de minimumdoelen die deze rubric afdekt (bv. "16.01", "BG04.02"). */
  doelen: string[];
  /** De omschrijving per kleur (blauw / groen / geel / rood). */
  criteria: Kleurcriteria;
  /** Waar de leerling vandaan komt en waar het naartoe gaat (leerlijn). */
  leerlijn: string;
}

/** De rollen die de app (voorlopig) kent. */
export type Basisrol = "leerling" | "mentor";

export interface Student {
  /** Stabiele sleutel — bedoeld als de Smartschool/OneRoster-gebruikersnaam of sourcedId. */
  id: string;
  firstName: string;
  lastName: string;
  vestiging: string;
  /** 1 t/m 6. De graad is hieruit afgeleid (1-2 = 1e graad, 3-4 = 2e, 5-6 = 3e). */
  leerjaar: number;
  /**
   * Het leerjaar per schooljaar (`{ "2025-2026": 3, "2026-2027": 4 }`) — gevuld door de
   * jaarlijkse klaslijst-import. Zo weet de app in welke graad/stroom een leerling in een
   * vorig schooljaar zat (voor een zittenblijver of een doorgestroomde leerling). Ontbreekt
   * een jaar, dan wordt het lineair teruggerekend vanaf `leerjaar`.
   */
  leerjaarHistoriek?: Record<string, number>;
  /** Klasgroep binnen het leerjaar, bv. "A" of "B". */
  klasgroep: string;
  email?: string;
  /** Fictief wachtwoord (enkel voor de demo-login; nooit een echt geheim). */
  wachtwoord?: string;
}

export interface Mentor {
  id: string;
  voornaam: string;
  naam: string;
  vestiging: string;
  email?: string;
  wachtwoord?: string;
}

/** Wie er momenteel is aangemeld. Enkel voor deze browsertab (sessionStorage). */
export interface Sessie {
  rol: Basisrol;
  id: string;
}

/** Zelfgemaakte leerlingengroep: een naam + een verzameling leerlingen. */
export interface Groep {
  id: string;
  naam: string;
  leerlingIds: string[];
  /** Koppeling: de mentor die deze groep aanmaakte / opvolgt. */
  mentorId?: string;
}

/**
 * Kleur per (schooljaar, leerling, badge). Bewaard als één map met sleutel
 * `${schooljaar}:${studentId}:${nodeId}`, waarbij `nodeId` altijd een leerdoel-id (badge) is.
 * (Vroeger kon het ook een cursus-/rubric-/subgroep-node zijn; die niveaus zijn weg.)
 * Een ontbrekende sleutel = "nog niet aangeboden / geëvalueerd".
 */
export type DoelKleuren = Record<string, Rating>;

export const doelSleutel = (
  schooljaar: string,
  studentId: string,
  nodeId: string,
): string => `${schooljaar}:${studentId}:${nodeId}`;

/** Notitie bij een badge voor één leerling in één schooljaar. */
export interface Notitie {
  /** Zichtbaar voor de leerling. */
  zichtbaar: string;
  /** Enkel voor mentoren/beheerders. */
  verborgen: string;
}

/** Sleutel `${schooljaar}:${studentId}:${nodeId}` → Notitie (nodeId = badge/leerdoel-id). */
export type Notities = Record<string, Notitie>;

export const notitieSleutel = (
  schooljaar: string,
  studentId: string,
  nodeId: string,
): string => `${schooljaar}:${studentId}:${nodeId}`;

export const LEGE_NOTITIE: Notitie = { zichtbaar: "", verborgen: "" };

/**
 * Een concrete deelevaluatie: een toets of opdracht die een leerkracht zelf aanmaakt,
 * gekoppeld aan één of meer badges. Het aanduiden van een kleur hier keurt de badge
 * NIET automatisch goed — het is een tussenstap die de mentor helpt beslissen.
 */
export interface Deelevaluatie {
  id: string;
  schooljaar: string;
  stroom: Stroom;
  /**
   * De vestiging waar deze deelbadge gegeven wordt. Alleen leerlingen van die vestiging zien
   * ze — een toets op de ene vestiging hoort niet bij een andere. `""` = alle vestigingen
   * (voorbeeld-/overkoepelende data).
   */
  vestiging: string;
  /** Cursusnaam (uit de deelevaluatie-kapstok), bv. "Actuaronde". */
  cursus: string;
  /** Optionele koppeling aan een type uit de kapstok (`deelevaluatieTypes`). */
  typeId: string | null;
  titel: string;
  /** "" of een datum "2026-03-12". */
  datum: string;
  /** Gekoppelde badges (leerdoel-id's). */
  leerdoelIds: string[];
  toelichting: string;
  /** De mentor die de deelevaluatie aanmaakte. */
  mentorId?: string;
  /** Epoch-ms van aanmaak. */
  aangemaaktOp?: number;
  /** Epoch-ms + gebruikers-id ("" = beheerder) van de laatste wijziging aan het record zelf
   * (titel, datum, gekoppelde badges, toelichting) — niet de kleuren per leerling. */
  gewijzigdOp?: number;
  gewijzigdDoor?: string;
}

/** Sleutel `${deelevaluatieId}:${studentId}` → Rating. Ontbreekt = niet gemaakt. */
export type DeelKleuren = Record<string, Rating>;

/** Sleutel `${deelevaluatieId}:${studentId}` → Notitie bij die deelevaluatiecel. */
export type DeelNotities = Record<string, Notitie>;

export const deelSleutel = (deelevaluatieId: string, studentId: string): string =>
  `${deelevaluatieId}:${studentId}`;

/**
 * Eén regel in de wijzigingsgeschiedenis van een evaluatiecel (kleur of notitie). De log is
 * append-only: een nieuwe waarde overschrijft de vorige niet in de geschiedenis, ze komt erbij.
 * `door` = de gebruikers-id, of "" voor de beheerder(smodus). `op` = epoch-ms. `van`/`naar` =
 * de waarde als tekst ("" = leeg; voor een kleur de `Rating`, voor een notitie een korte
 * weergave).
 */
export interface AuditRegel {
  op: number;
  door: string;
  veld: "kleur" | "notitie";
  van: string;
  naar: string;
}

/** Sleutel (`doelSleutel` / `deelSleutel`) → chronologische geschiedenis, oudste eerst. */
export type AuditLog = Record<string, AuditRegel[]>;

/**
 * Een melding voor het meldingencentrum van de leerling: "nieuwe beoordeling(en) in cursus X".
 * Enkel in de app zichtbaar (geen push naar toestel). Meerdere beoordelingen in dezelfde cursus
 * worden samengevoegd tot één melding met een teller.
 */
export interface Melding {
  id: string;
  /** Tijdstip van de (laatste) beoordeling. */
  ts: number;
  studentId: string;
  soort: "kleur" | "deelevaluatie";
  /** Curriculum-cursus-id om naar `/vak/:id` te springen; "" als onbekend. */
  cursusId: string;
  cursusNaam: string;
  /** Hoeveel beoordelingen deze melding samenvat. */
  aantal: number;
}
