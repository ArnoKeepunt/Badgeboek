/**
 * Het vestiging-bereik van de aangemelde gebruiker, voor de **Firestore-queries** in
 * `firebasePersistentie`. De regels schermen `leerlingen` / `evaluaties` / `deelbadges` per
 * vestiging af; een mentor moet zijn query dus beperken tot `where("vestiging", "in", [...])`,
 * anders weigert Firestore de hele query.
 *
 * Gezet door `src/lib/firebaseAuth.ts` zodra het `gebruikers`-account geladen is. Los van
 * `rechten.ts` (dat is de client-side UI-filter — dit stuurt wát er überhaupt opgehaald wordt).
 */
export interface FirebaseBereik {
  /** `false` zolang `firebaseAuth` het bereik nog niet gezet heeft — dan nog niet abonneren. */
  bekend: boolean;
  /** `true` = alle vestigingen (beheerder / coördinator / bootstrap) → geen query-filter. */
  alles: boolean;
  /** Als `!alles`: de campussen die opgehaald mogen worden. Leeg = niets zichtbaar. */
  vestigingen: string[];
  /**
   * Beheerder (of bootstrap-admin): mag ook de beheerder-only collecties schrijven die in
   * `bewaar()` meerijden (`vestigingen`, `rubrieken`, afgewerkte `rapporten`). Een coördinator
   * heeft wél `alles`, maar niet dit.
   */
  beheerder: boolean;
}

let bereik: FirebaseBereik = { bekend: false, alles: false, vestigingen: [], beheerder: false };
const luisteraars = new Set<() => void>();

const sleutel = (b: FirebaseBereik) =>
  `${b.bekend ? "?" : ""}${b.alles ? "*" : ""}${b.beheerder ? "!" : ""}|${[...b.vestigingen].sort().join(",")}`;

export function zetFirebaseBereik(next: Omit<FirebaseBereik, "bekend"> | null): void {
  // `null` = terug naar "onbekend" (bij afmelden / auth-reset).
  const nieuw: FirebaseBereik = next
    ? { bekend: true, ...next }
    : { bekend: false, alles: false, vestigingen: [], beheerder: false };
  if (sleutel(nieuw) === sleutel(bereik)) return;
  bereik = nieuw;
  luisteraars.forEach((fn) => fn());
}

export const huidigBereik = (): FirebaseBereik => bereik;

/** Reageer op een bereik-wissel (login, rolwijziging) — `firebasePersistentie` herabonneert dan. */
export function opBereikWissel(fn: () => void): () => void {
  luisteraars.add(fn);
  return () => luisteraars.delete(fn);
}
