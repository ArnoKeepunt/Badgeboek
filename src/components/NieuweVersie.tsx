import { useEffect, useState } from "react";
import { bewaarAlles } from "../lib/opslagStatus";
import { HUIDIGE_VERSIE, leesOnlineVersie } from "../lib/versie";

/** Zo vaak kijkt een open tabblad of er een nieuwe versie online staat. */
const CONTROLE_INTERVAL_MS = 10 * 60 * 1000;

async function herlaad() {
  await bewaarAlles(); // eerst bewaren; lukt dat niet, dan vraagt de browser zelf om bevestiging
  window.location.reload();
}

/**
 * Kleine melding voor wie een oudere versie van het Badgeboek draait dan wat online staat (bv.
 * een tabblad dat al dagen openstaat). Wie de huidige versie heeft, ziet nooit iets. Blokkeert
 * niets: je kan gewoon verder werken en herladen wanneer het past.
 */
export function NieuweVersie({ versie = HUIDIGE_VERSIE }: { versie?: string }) {
  const [verouderd, setVerouderd] = useState(false);

  useEffect(() => {
    if (!versie) return; // `vite dev` / tests: geen versie, geen controle
    let actief = true;
    const controleer = async () => {
      const online = await leesOnlineVersie();
      if (actief && online !== null && online !== versie) setVerouderd(true);
    };
    const opZichtbaar = () => {
      if (document.visibilityState === "visible") void controleer();
    };
    const timer = window.setInterval(controleer, CONTROLE_INTERVAL_MS);
    document.addEventListener("visibilitychange", opZichtbaar);
    return () => {
      actief = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", opZichtbaar);
    };
  }, [versie]);

  if (!verouderd) return null;
  return (
    <div className="nieuwe-versie" role="status">
      <span>Er is een nieuwe versie van het Badgeboek.</span>
      <button type="button" className="knop-primair" onClick={() => void herlaad()}>
        Herladen
      </button>
    </div>
  );
}
