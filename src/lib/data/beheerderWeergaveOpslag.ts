export interface BeheerderWeergave {
  /** `true` = deze beheerder heeft de vereenvoudigde (mentor-achtige) weergave aanstaan. */
  vereenvoudigd: boolean;
}

const LEEG: BeheerderWeergave = { vereenvoudigd: false };

/**
 * De "beheerdersmodus uit"-schakelaar is een persoonlijke weergavevoorkeur, geen accountgegeven:
 * ze verandert niets aan de echte rol/Firestore-rechten, leeft per browser in `localStorage` en
 * is dus expres niet onderdeel van de gedeelde store. Vergelijkbaar met `matrixVoorkeur.ts`.
 * De vestiging(en) waartoe de vereenvoudigde weergave zich beperkt staan wél gewoon op het
 * account (`Personeelslid.vestigingen`, bij Gebruikers) — die horen bij het personeelslid, niet
 * bij één browser.
 */
const KEY = "keerpunt-badgeboek:beheerder-weergave";

export const beheerderWeergaveOpslag = {
  laad(): BeheerderWeergave {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return LEEG;
      const d = JSON.parse(raw) as Partial<BeheerderWeergave>;
      return { vereenvoudigd: d.vereenvoudigd === true };
    } catch {
      return LEEG;
    }
  },
  bewaar(weergave: BeheerderWeergave): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(weergave));
    } catch {
      // opslag niet beschikbaar (privémodus) — voorkeur leeft dan enkel in het geheugen
    }
  },
};
