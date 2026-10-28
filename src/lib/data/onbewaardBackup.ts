import type { DocData } from "./firestoreLayout";
import type { Overlays } from "./persistentie";

/**
 * Back-up van wat er nog niet in de database staat, in de browser (localStorage). Elke
 * schrijfactie zet eerst wat ze verstuurt hier neer en wist het zodra de server bevestigt.
 * Overleeft dus herladen, het tabblad sluiten, een crash of een verlopen sessie: na het opnieuw
 * aanmelden met hetzelfde account wordt het alsnog verstuurd (`herstelBackups` in
 * `firebasePersistentie.ts`).
 *
 * Eén sleutel per soort per tabblad-sessie, zodat twee open tabbladen elkaars back-up niet
 * overschrijven. De id is per paginalading (niet per tab): na herladen is de oude back-up dus
 * "wees" en wordt ze hersteld, terwijl de back-up van een tabblad dat nog leeft met rust gelaten
 * wordt door datzelfde tabblad.
 */
const VOORVOEGSEL = "keerpunt-badgeboek:onbewaard:";
/** Oudere back-ups worden niet meer hersteld: de kans dat ze nog kloppen is te klein. */
export const BACKUP_MAX_LEEFTIJD_MS = 7 * 24 * 60 * 60 * 1000;

export type BackupSoort = "docs" | "overlays";

export interface Backup {
  /** Het account dat de wijziging maakte — enkel dat account mag ze ooit versturen. */
  email: string;
  /** Wanneer de schrijfactie vertrok. Wat de server later nog wijzigde, gaat voor. */
  tijd: number;
  /** Volgnummer binnen dit tabblad: een oudere schrijfactie mag een nieuwere back-up niet wissen. */
  nr: number;
  schrijf?: Array<[string, DocData]>;
  verwijder?: string[];
  /**
   * De serverstand per pad vlak vóór de schrijfactie (`null` = bestond niet). Het herstel
   * schrijft enkel waar de server nog zo staat. Ontbreekt bij back-ups van vóór 28/10/2026.
   */
  voor?: Record<string, DocData | null>;
  overlays?: Overlays;
}

const tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const sleutel = (soort: BackupSoort, tab = tabId) => `${VOORVOEGSEL}${soort}:${tab}`;
let volgnr = 0;

/** Zet een back-up neer; geeft het volgnummer terug om ze later gericht te wissen. */
export function zetBackup(soort: BackupSoort, data: Omit<Backup, "nr" | "tijd">): number {
  const nr = ++volgnr;
  try {
    localStorage.setItem(sleutel(soort), JSON.stringify({ ...data, nr, tijd: Date.now() }));
  } catch {
    // Privévenster / opslag vol: dan beschermt enkel de herprobeer-logica in het geheugen.
  }
  return nr;
}

/** Wis de back-up van dit tabblad, maar enkel als ze nog van deze schrijfactie (`nr`) is. */
export function wisBackup(soort: BackupSoort, nr: number): void {
  try {
    const ruw = localStorage.getItem(sleutel(soort));
    if (ruw && (JSON.parse(ruw) as Backup).nr === nr) localStorage.removeItem(sleutel(soort));
  } catch {
    // niets te wissen
  }
}

/**
 * Achtergebleven back-ups van dit account uit een vorige paginalading of een ander tabblad,
 * oudste eerst. Te oude back-ups worden meteen opgeruimd. Back-ups van andere accounts blijven
 * staan (die herstelt dat account zelf bij een volgende login op deze browser).
 */
export function wezen(email: string): Array<{ sleutel: string; soort: BackupSoort; backup: Backup }> {
  const uit: Array<{ sleutel: string; soort: BackupSoort; backup: Backup }> = [];
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k?.startsWith(VOORVOEGSEL)) continue;
      const [soort, tab] = k.slice(VOORVOEGSEL.length).split(":") as [BackupSoort, string];
      if (tab === tabId) continue; // eigen, levende back-up
      let backup: Backup;
      try {
        backup = JSON.parse(localStorage.getItem(k) ?? "") as Backup;
      } catch {
        localStorage.removeItem(k); // onleesbaar
        continue;
      }
      if (Date.now() - backup.tijd > BACKUP_MAX_LEEFTIJD_MS) {
        localStorage.removeItem(k);
        continue;
      }
      if (backup.email === email) uit.push({ sleutel: k, soort, backup });
    }
  } catch {
    return [];
  }
  return uit.sort((a, b) => a.backup.tijd - b.backup.tijd);
}

export function verwijderSleutel(k: string): void {
  try {
    localStorage.removeItem(k);
  } catch {
    // niets te wissen
  }
}
