import { useSyncExternalStore } from "react";

/**
 * De status van het wegschrijven naar de database (firebase-modus). De gebatchte `bewaar()` in
 * `src/lib/data/firebasePersistentie.ts` draait los van de UI — zonder deze status zou een
 * geweigerde of mislukte schrijfactie stil verdwijnen (de wijziging blijft dan wel lokaal
 * zichtbaar, maar staat niet in de database). `Layout` toont een balk bij `"fout"`.
 */
export type OpslagStatus =
  | { soort: "ok" }
  | { soort: "fout"; reden: "rechten" | "verbinding" | "onbekend"; melding: string };

let status: OpslagStatus = { soort: "ok" };
const luisteraars = new Set<() => void>();

export function zetOpslagStatus(nieuw: OpslagStatus): void {
  if (status.soort === nieuw.soort && status.soort === "ok") return;
  status = nieuw;
  luisteraars.forEach((fn) => fn());
}

/** Een Firestore-schrijffout → korte reden + Nederlandse melding voor de balk. */
export function duidOpslagFout(error: unknown): OpslagStatus {
  const tekst = error instanceof Error ? error.message : String(error);
  if (/permission[-_ ]?denied|insufficient permissions/i.test(tekst)) {
    return {
      soort: "fout",
      reden: "rechten",
      melding:
        "Wijzigingen worden niet in de database bewaard: die weigert de schrijfactie. " +
        "Meestal betekent dit dat de Firestore-regels nog niet (opnieuw) gedeployed zijn, " +
        "of dat je account geen schrijfrechten heeft.",
    };
  }
  if (/unavailable|network|offline|deadline[-_ ]?exceeded|failed to get document/i.test(tekst)) {
    return {
      soort: "fout",
      reden: "verbinding",
      melding: "Geen verbinding met de database — wijzigingen zijn nog niet bewaard.",
    };
  }
  return {
    soort: "fout",
    reden: "onbekend",
    melding: "Opslaan naar de database mislukte — je laatste wijziging is mogelijk niet bewaard.",
  };
}

const abonneer = (cb: () => void) => {
  luisteraars.add(cb);
  return () => luisteraars.delete(cb);
};
const lees = () => status;

/** Hook: de huidige opslagstatus (voor de foutbalk in `Layout`). */
export function useOpslagStatus(): OpslagStatus {
  return useSyncExternalStore(abonneer, lees, lees);
}
