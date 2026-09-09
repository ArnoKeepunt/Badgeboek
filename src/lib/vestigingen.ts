/**
 * De vestigingen (campussen) van Keerpunt. Eén canonieke lijst i.p.v. losse tekststrings.
 *
 * Leerlingen/mentoren/personeel/deelbadges bewaren de vestiging **op naam** (`vestiging: "Gent"`)
 * — die naam is de koppeling met deze lijst. De beheerder bewerkt de lijst op `/vestigingen`
 * (Firestore-collectie `vestigingen/{id}`); zonder database valt de app terug op de bundel.
 * Hernoemen loopt via een cascade over alle betrokken documenten (`hernoemVestiging` in store.ts).
 */

export interface Vestiging {
  /** Stabiele slug, bv. "gent". Blijft gelijk bij hernoemen. */
  id: string;
  /** Weergavenaam én de waarde die op leerlingen/mentoren/deelbadges staat, bv. "Gent". */
  naam: string;
  /** Inactieve vestigingen blijven bestaan (voor historische data) maar staan niet in keuzelijsten. */
  actief: boolean;
  volgorde: number;
}

/** Slug voor een doc-id: kleine letters, accenten weg, niet-alfanumeriek → "-". */
export const vestigingSlug = (naam: string): string =>
  naam
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "vestiging";

export const GEBUNDELDE_VESTIGINGEN: Vestiging[] = [
  { id: "gent", naam: "Gent", actief: true, volgorde: 0 },
  { id: "molenbeek", naam: "Molenbeek", actief: true, volgorde: 1 },
  { id: "oudenaarde", naam: "Oudenaarde", actief: true, volgorde: 2 },
];

const sorteer = (lijst: Vestiging[]): Vestiging[] =>
  [...lijst].sort((a, b) => a.volgorde - b.volgorde || a.naam.localeCompare(b.naam, "nl"));

let actief: Vestiging[] = sorteer(GEBUNDELDE_VESTIGINGEN);

/** Zet de database-versie (of `null` om terug te vallen op de bundel). */
export function zetVestigingen(lijst: Vestiging[] | null): void {
  actief = sorteer(lijst && lijst.length > 0 ? lijst : GEBUNDELDE_VESTIGINGEN);
}

/** Alle vestigingen, inclusief inactieve (voor overzichten en historische data). */
export const alleVestigingen = (): Vestiging[] => actief;

/** Alleen de actieve vestigingen — voor keuzelijsten. */
export const actieveVestigingen = (): Vestiging[] => actief.filter((v) => v.actief);

export const vestigingViaNaam = (naam: string): Vestiging | undefined =>
  actief.find((v) => v.naam === naam);

export const vestigingViaId = (id: string): Vestiging | undefined =>
  actief.find((v) => v.id === id);

export const isGeldigeVestiging = (d: unknown): d is Vestiging =>
  Boolean(d) &&
  typeof d === "object" &&
  typeof (d as Vestiging).id === "string" &&
  typeof (d as Vestiging).naam === "string" &&
  typeof (d as Vestiging).actief === "boolean";

/**
 * De namen voor een keuzelijst: de actieve vestigingen, plus elke naam die al in de data
 * voorkomt maar (nog) niet in de lijst staat — zo blijft bestaande data altijd filterbaar.
 */
export function vestigingKeuzes(inGebruik: Iterable<string> = []): string[] {
  const namen = actieveVestigingen().map((v) => v.naam);
  const set = new Set(namen);
  for (const n of inGebruik) if (n && !set.has(n)) namen.push(n);
  return namen;
}
