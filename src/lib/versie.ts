/** De versie van de code in dit tabblad. Leeg tijdens `vite dev` en in tests: dan geen controle. */
export const HUIDIGE_VERSIE = import.meta.env.VITE_BADGEBOEK_VERSIE ?? "";

/**
 * De versie die nu online staat (`versie.json`, naast de app — zie `vite.config.ts`). `null` als
 * dat niet lukt (offline, bestand ontbreekt…): dan zeggen we liever niets dan iets verkeerds.
 * Relatief opgehaald, net zoals de app haar eigen bestanden laadt, zodat het ook in een submap
 * werkt.
 */
export async function leesOnlineVersie(): Promise<string | null> {
  try {
    const antwoord = await fetch(`versie.json?t=${Date.now()}`, { cache: "no-store" });
    if (!antwoord.ok) return null;
    const data: unknown = await antwoord.json();
    const versie = (data as { versie?: unknown } | null)?.versie;
    return typeof versie === "string" && versie !== "" ? versie : null;
  } catch {
    return null;
  }
}
