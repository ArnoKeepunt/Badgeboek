import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { meldAfVanFirebase } from "../lib/data";
import {
  ACTIVITEIT_SLEUTEL,
  INACTIEF_MS,
  WAARSCHUWING_MS,
  leesLaatsteActiviteit,
  schrijfLaatsteActiviteit,
  zetAfgemeldWegensInactiviteit,
} from "../lib/inactiviteit";
import { Modal } from "./Modal";

/** Activiteit schrijven we hooguit zo vaak weg (mousemove vuurt honderden keren per seconde). */
const SCHRIJF_INTERVAL_MS = 10 * 1000;

const ACTIVITEIT_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

/**
 * Meldt een aangemelde gebruiker automatisch af na {@link INACTIEF_MS} zonder muis-, toets- of
 * aanraakactiviteit. Twee minuten vooraf verschijnt een melding met aftelling. Een slapende
 * laptop of een tabblad op de achtergrond wordt opnieuw gecontroleerd zodra het weer zichtbaar
 * wordt, zodat ook "nooit gesloten" tabbladen netjes afgemeld worden.
 */
export function AutoAfmelden({ gebruiker }: { gebruiker: User }) {
  const laatsteRef = useRef(0); // gezet bij het openen, zie hieronder
  const geschrevenRef = useRef(0);
  const [resterend, setResterend] = useState<number | null>(null);

  // Afmelden is async: tot Firebase klaar is, mogen latere controles het niet opnieuw starten.
  const bezigRef = useRef(false);

  const afmelden = useCallback(() => {
    if (bezigRef.current) return;
    bezigRef.current = true;
    zetAfgemeldWegensInactiviteit(true);
    void meldAfVanFirebase();
  }, []);

  const controleer = useCallback(() => {
    // Een ander tabblad kan intussen activiteit gezien hebben.
    const gedeeld = leesLaatsteActiviteit();
    if (gedeeld && gedeeld > laatsteRef.current) laatsteRef.current = gedeeld;
    const over = laatsteRef.current + INACTIEF_MS - Date.now();
    if (over <= 0) {
      afmelden();
      return;
    }
    setResterend(over <= WAARSCHUWING_MS ? over : null);
  }, [afmelden]);

  const registreer = useCallback(() => {
    const nu = Date.now();
    laatsteRef.current = nu;
    if (nu - geschrevenRef.current >= SCHRIJF_INTERVAL_MS) {
      geschrevenRef.current = nu;
      schrijfLaatsteActiviteit(nu);
    }
  }, []);

  const blijfAangemeld = useCallback(() => {
    geschrevenRef.current = 0; // meteen wegschrijven, zodat ook de andere tabbladen het weten
    registreer();
    setResterend(null);
  }, [registreer]);

  // Bij het openen: net aangemeld → teller vers starten. Anders (bv. een herladen tabblad na een
  // nacht) telt de opgeslagen activiteit, zodat herladen geen achterpoortje is.
  useEffect(() => {
    const aangemeldOp = Date.parse(gebruiker.metadata.lastSignInTime ?? "") || 0;
    const opgeslagen = leesLaatsteActiviteit();
    if (!opgeslagen || aangemeldOp > opgeslagen) {
      const nu = Date.now();
      laatsteRef.current = nu;
      geschrevenRef.current = nu;
      schrijfLaatsteActiviteit(nu);
    } else {
      laatsteRef.current = opgeslagen;
      controleer();
    }
  }, [gebruiker, controleer]);

  useEffect(() => {
    // Tijdens de waarschuwing telt enkel de knop: per ongeluk de muis bewegen is geen "ik ben er".
    // En enkel met focus: een Badgeboek-venster dat zichtbaar op een tweede scherm staat, krijgt
    // ook muisbewegingen door terwijl je in een andere app of website werkt — dat telt niet.
    const opActiviteit = () => {
      if (resterend === null && document.hasFocus()) registreer();
    };
    const opZichtbaar = () => {
      if (document.visibilityState === "visible") controleer();
    };
    const opOpslag = (e: StorageEvent) => {
      if (e.key === ACTIVITEIT_SLEUTEL) controleer();
    };

    for (const naam of ACTIVITEIT_EVENTS) {
      window.addEventListener(naam, opActiviteit, { passive: true });
    }
    document.addEventListener("visibilitychange", opZichtbaar);
    window.addEventListener("focus", controleer);
    window.addEventListener("storage", opOpslag);
    const timer = window.setInterval(controleer, resterend === null ? 15_000 : 1_000);

    return () => {
      for (const naam of ACTIVITEIT_EVENTS) window.removeEventListener(naam, opActiviteit);
      document.removeEventListener("visibilitychange", opZichtbaar);
      window.removeEventListener("focus", controleer);
      window.removeEventListener("storage", opOpslag);
      window.clearInterval(timer);
    };
  }, [resterend, registreer, controleer]);

  if (resterend === null) return null;

  const seconden = Math.ceil(resterend / 1000);
  const tekst =
    seconden >= 60
      ? `${Math.floor(seconden / 60)}:${String(seconden % 60).padStart(2, "0")}`
      : `${seconden} seconden`;

  return (
    <Modal onClose={blijfAangemeld} label="Ben je er nog?">
      <h2 className="auto-afmelden-titel">Ben je er nog?</h2>
      <p className="auto-afmelden-tekst">
        Je was een tijdje niet actief. Om de gegevens van leerlingen te beschermen word je over{" "}
        <strong>{tekst}</strong> automatisch afgemeld.
      </p>
      <div className="auto-afmelden-knoppen">
        <button type="button" className="knop-secundair" onClick={() => void meldAfVanFirebase()}>
          Nu afmelden
        </button>
        <button type="button" className="knop-primair" onClick={blijfAangemeld}>
          Aangemeld blijven
        </button>
      </div>
    </Modal>
  );
}
