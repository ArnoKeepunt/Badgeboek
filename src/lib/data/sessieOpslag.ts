import type { Sessie } from "../types";

/**
 * De sessie ("wie kijk ik nu als") leeft **per browsertab** en staat los van de gedeelde
 * store — ook straks met Firebase-auth blijft dit lokaal (het is niet de identiteit zelf,
 * enkel de gekozen rol/gebruiker in deze demo). Daarom een apart, altijd-synchroon opslagje.
 */
const SESSIE_KEY = "keerpunt-badgeboek:sessie";

export const sessieOpslag = {
  laad(): Sessie | null {
    try {
      const raw = sessionStorage.getItem(SESSIE_KEY);
      return raw ? (JSON.parse(raw) as Sessie) : null;
    } catch {
      return null;
    }
  },
  bewaar(sessie: Sessie | null): void {
    try {
      if (sessie) sessionStorage.setItem(SESSIE_KEY, JSON.stringify(sessie));
      else sessionStorage.removeItem(SESSIE_KEY);
    } catch {
      // opslag niet beschikbaar (privémodus) — sessie leeft dan enkel in het geheugen
    }
  },
};
