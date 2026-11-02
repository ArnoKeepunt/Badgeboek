import { useCallback, useEffect, useRef, useState } from "react";
import { PERSISTENTIE_MODUS } from "./data";
import {
  type BewerkSlot,
  abonneerBewerkSlot,
  geefBewerkSlotVrij,
  neemBewerkSlot,
  verlengBewerkSlot,
} from "./data/bewerkSloten";
import { useAuthStatus } from "./firebaseAuth";

/** Zo lang blijft een slot geldig zonder hartslag (gecrasht/gesloten tabblad). */
const SLOT_DUUR_MS = 2 * 60_000;
/** Om de hoeveel tijd het eigen slot verlengd wordt zolang het veld open staat. */
const HARTSLAG_MS = 40_000;
/**
 * Pas zo lang na het verlaten van het veld vrijgeven: de tekst zelf vertrekt via de gedebouncete
 * app-save (`bewaar()`). Komt de volgende mentor er te snel in, dan ziet die nog de oude tekst en
 * overschrijft hij de jouwe.
 */
const VRIJGEVEN_NA_MS = 3_000;

export interface BewerkSlotStatus {
  /** Iemand anders bewerkt dit veld nu — met naam. `null` = vrij (of van jou). */
  doorAnder: BewerkSlot | null;
  /** Probeer het slot te nemen. `false` = iemand anders was je net voor. */
  neem: () => Promise<boolean>;
  /** Het veld verlaten: het slot wordt (met een korte vertraging) vrijgegeven. */
  laatLos: () => void;
  /** Heb je het slot nu? (Zonder slot-id of in local-modus: altijd `true`.) */
  isVanMij: () => boolean;
}

/**
 * Eén vrij tekstveld tegelijk door één persoon laten bewerken (bv. "Commentaar klassenraad").
 * `id = null` of local-modus (één gebruiker, geen gedeelde database) → geen slot, alles mag.
 */
export function useBewerkSlot(id: string | null): BewerkSlotStatus {
  const { gebruiker, persoon } = useAuthStatus();
  const email = gebruiker?.email ?? null;
  const naam = persoon?.naam || email || "";
  const actief = PERSISTENTIE_MODUS === "firebase" && id !== null && email !== null;

  const [houder, setHouder] = useState<BewerkSlot | null>(null);
  // Herrenderen zodra het slot van een ander verloopt (crash/gesloten tabblad zonder vrijgeven).
  const [verlopen, setVerlopen] = useState<BewerkSlot | null>(null);
  const vanMij = useRef(false);
  const hartslag = useRef<ReturnType<typeof setInterval> | null>(null);
  const loslaten = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!actief || !id) return;
    return abonneerBewerkSlot(id, setHouder);
  }, [actief, id]);

  useEffect(() => {
    if (!houder || houder.email === email) return;
    const t = setTimeout(() => setVerlopen(houder), Math.max(0, houder.tot - Date.now()) + 500);
    return () => clearTimeout(t);
  }, [houder, email]);

  const stopHartslag = () => {
    if (hartslag.current) clearInterval(hartslag.current);
    hartslag.current = null;
  };

  const geefVrij = useCallback(() => {
    if (loslaten.current) clearTimeout(loslaten.current);
    loslaten.current = null;
    stopHartslag();
    if (!vanMij.current || !id) return;
    vanMij.current = false;
    geefBewerkSlotVrij(id).catch((err) => console.warn("Bewerkslot vrijgeven mislukt:", err));
  }, [id]);

  // Weg van de pagina/ander rapport: meteen vrijgeven (de tekst zelf bewaart het veld al).
  useEffect(() => geefVrij, [geefVrij]);

  const neem = async (): Promise<boolean> => {
    if (!actief || !id) return true;
    // Terug in het veld vóór het vrijgeven: gewoon verder, het slot is nog van jou.
    if (loslaten.current) {
      clearTimeout(loslaten.current);
      loslaten.current = null;
      if (vanMij.current) return true;
    }
    try {
      const ander = await neemBewerkSlot(id, naam, SLOT_DUUR_MS);
      if (ander) {
        setHouder(ander);
        return false;
      }
    } catch (err) {
      // Offline, of de regels kennen `bewerkSloten` nog niet (app vóór de regels uitgerold):
      // het slot is een beleefdheidsafspraak, geen beveiliging — dan gewoon laten bewerken,
      // zoals vóór het slot bestond, in plaats van het veld voor iedereen te blokkeren.
      console.warn("Bewerkslot nemen mislukt — veld blijft bewerkbaar:", err);
      vanMij.current = true;
      return true;
    }
    vanMij.current = true;
    stopHartslag();
    hartslag.current = setInterval(() => {
      verlengBewerkSlot(id, SLOT_DUUR_MS).catch((err) =>
        console.warn("Bewerkslot verlengen mislukt:", err),
      );
    }, HARTSLAG_MS);
    return true;
  };

  const laatLos = () => {
    if (!actief || !vanMij.current) return;
    if (loslaten.current) clearTimeout(loslaten.current);
    loslaten.current = setTimeout(geefVrij, VRIJGEVEN_NA_MS);
  };

  const doorAnder =
    actief && houder && houder.email !== email && houder !== verlopen ? houder : null;

  return { doorAnder, neem, laatLos, isVanMij: () => !actief || vanMij.current };
}
