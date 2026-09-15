import type { Stroom } from "../types";

export interface MatrixVoorkeur {
  stromen: Stroom[];
  cursus: string;
}

/**
 * De stroom-/cursusfilter op de matrix-pagina's (Badges / Deelevaluaties / Rubrics) is een
 * persoonlijke UI-voorkeur ("waar sta ik nu naar te kijken"), geen gedeelde data. Die hoort dus
 * niet in de gedeelde `bewaar()` — die is personeel-breed, ook in firebase-modus (zie
 * `firestoreLayout.ts`, `instellingen/app`) — maar leeft per browser in `localStorage`. Zo
 * bepaalt de laatste klik van de ene mentor niet mee wat een andere mentor of de beheerder te
 * zien krijgt. Vergelijkbaar met `sessieOpslag`, die de sessie zelf per browsertab houdt.
 */
const MATRIX_VOORKEUR_KEY = "keerpunt-badgeboek:matrix-voorkeur";

export const matrixVoorkeurOpslag = {
  laad(): MatrixVoorkeur | null {
    try {
      const raw = localStorage.getItem(MATRIX_VOORKEUR_KEY);
      return raw ? (JSON.parse(raw) as MatrixVoorkeur) : null;
    } catch {
      return null;
    }
  },
  bewaar(voorkeur: MatrixVoorkeur): void {
    try {
      localStorage.setItem(MATRIX_VOORKEUR_KEY, JSON.stringify(voorkeur));
    } catch {
      // opslag niet beschikbaar (privémodus) — voorkeur leeft dan enkel in het geheugen
    }
  },
};
