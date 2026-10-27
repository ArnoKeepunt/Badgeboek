import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { meldAfMetBewaren } from "../lib/afmelden";
import { bevestigAanmelding, meldAfVanFirebase, sessieBeginVan } from "../lib/data";
import {
  ACTIVITEIT_SLEUTEL,
  type AfmeldReden,
  INACTIEF_MS,
  MAX_SESSIE_MS,
  SESSIE_WAARSCHUWING_MS,
  WAARSCHUWING_MS,
  leesLaatsteActiviteit,
  schrijfLaatsteActiviteit,
  zetAfmeldReden,
} from "../lib/inactiviteit";
import { bewaarAlles } from "../lib/opslagStatus";
import { Modal } from "./Modal";

/** Activiteit schrijven we hooguit zo vaak weg (mousemove vuurt honderden keren per seconde). */
const SCHRIJF_INTERVAL_MS = 10 * 1000;

const ACTIVITEIT_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

/** Wat er op het scherm staat. `resterend` = ms tot het afmelden. */
type Melding =
  | { soort: "inactief"; resterend: number }
  | { soort: "sessie"; resterend: number }
  /** Tijd is om, maar er staat nog onbewaard werk open: wachten met afmelden. */
  | { soort: "wachtOpOpslag"; reden: AfmeldReden }
  | null;

/**
 * Meldt een aangemelde gebruiker automatisch af:
 *
 * - na {@link INACTIEF_MS} zonder muis-, toets- of aanraakactiviteit (twee minuten vooraf een
 *   melding met aftelling — "Aangemeld blijven" volstaat);
 * - na {@link MAX_SESSIE_MS} sinds de laatste echte Google-login, ook bij activiteit. Dat dwingen
 *   de Firestore-regels ook aan de serverkant af; vijf minuten vooraf vraagt dit om de login te
 *   bevestigen (Google-pop-up), zodat je verder kan zonder iets te verliezen.
 *
 * Een slapende laptop of een tabblad op de achtergrond wordt opnieuw gecontroleerd zodra het weer
 * zichtbaar wordt. Vóór het afmelden wordt alles bewaard; lukt dat niet (bv. geen verbinding),
 * dan meldt dit niet af maar toont het een melding en probeert het opnieuw tot alles bewaard is.
 */
export function AutoAfmelden({ gebruiker }: { gebruiker: User }) {
  const laatsteRef = useRef(0); // gezet bij het openen, zie hieronder
  const geschrevenRef = useRef(0);
  /** Einde van de sessie (ms), zodra het token gelezen is. */
  const sessieEindeRef = useRef<number | null>(null);
  const [melding, setMelding] = useState<Melding>(null);
  const [bevestigFout, setBevestigFout] = useState("");

  // Afmelden is async: tot Firebase klaar is, mogen latere controles het niet opnieuw starten.
  const bezigRef = useRef(false);

  const afmelden = useCallback(async (reden: AfmeldReden) => {
    if (bezigRef.current) return;
    bezigRef.current = true;
    if (await bewaarAlles()) {
      zetAfmeldReden(reden);
      await meldAfVanFirebase();
      return;
    }
    bezigRef.current = false; // de volgende controle probeert opnieuw
    setMelding({ soort: "wachtOpOpslag", reden });
  }, []);

  const controleer = useCallback(() => {
    // Een ander tabblad kan intussen activiteit gezien hebben.
    const gedeeld = leesLaatsteActiviteit();
    if (gedeeld && gedeeld > laatsteRef.current) laatsteRef.current = gedeeld;
    const nu = Date.now();
    const overInactief = laatsteRef.current + INACTIEF_MS - nu;
    const overSessie = (sessieEindeRef.current ?? Infinity) - nu;

    if (overSessie <= 0) return void afmelden("sessie");
    if (overInactief <= 0) return void afmelden("inactief");
    // De sessie-melding gaat voor: daar helpt "Aangemeld blijven" niet.
    if (overSessie <= SESSIE_WAARSCHUWING_MS) {
      setMelding({ soort: "sessie", resterend: overSessie });
    } else if (overInactief <= WAARSCHUWING_MS) {
      setMelding({ soort: "inactief", resterend: overInactief });
    } else {
      setMelding(null);
    }
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
    controleer(); // sluit de melding — tenzij de sessie zelf afloopt
  }, [registreer, controleer]);

  const leesSessieEinde = useCallback(async () => {
    try {
      sessieEindeRef.current = (await sessieBeginVan(gebruiker)) + MAX_SESSIE_MS;
    } catch {
      // Token (nog) niet leesbaar: dan bewaakt enkel de Firestore-regel de sessieduur.
    }
  }, [gebruiker]);

  /** Google-login opnieuw bevestigen: nieuwe sessie, zonder af te melden of werk te verliezen. */
  const bevestig = useCallback(async () => {
    setBevestigFout("");
    try {
      await bevestigAanmelding();
    } catch (err) {
      const code = err instanceof Error && "code" in err ? String((err as { code: unknown }).code) : "";
      setBevestigFout(
        code === "auth/user-mismatch"
          ? "Dat is een ander account. Bevestig met het account waarmee je nu aangemeld bent."
          : "Bevestigen is niet gelukt. Probeer opnieuw.",
      );
      return;
    }
    await leesSessieEinde();
    blijfAangemeld();
    // Werk dat door de verlopen sessie geweigerd werd, kan nu wel door.
    void bewaarAlles();
  }, [leesSessieEinde, blijfAangemeld]);

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
    }
    void leesSessieEinde().then(controleer);
  }, [gebruiker, leesSessieEinde, controleer]);

  useEffect(() => {
    // Zodra er een melding staat, telt enkel een knop: per ongeluk de muis bewegen is geen "ik
    // ben er". En enkel met focus: een Badgeboek-venster dat zichtbaar op een tweede scherm
    // staat, krijgt ook muisbewegingen door terwijl je in een andere app of website werkt.
    const opActiviteit = () => {
      if (melding === null && document.hasFocus()) registreer();
    };
    const opZichtbaar = () => {
      if (document.visibilityState === "visible") controleer();
    };
    const opOpslag = (e: StorageEvent) => {
      if (e.key === ACTIVITEIT_SLEUTEL) controleer();
    };
    const aftellen = melding?.soort === "inactief" || melding?.soort === "sessie";

    for (const naam of ACTIVITEIT_EVENTS) {
      window.addEventListener(naam, opActiviteit, { passive: true });
    }
    document.addEventListener("visibilitychange", opZichtbaar);
    window.addEventListener("focus", controleer);
    window.addEventListener("storage", opOpslag);
    const timer = window.setInterval(controleer, aftellen ? 1_000 : 15_000);

    return () => {
      for (const naam of ACTIVITEIT_EVENTS) window.removeEventListener(naam, opActiviteit);
      document.removeEventListener("visibilitychange", opZichtbaar);
      window.removeEventListener("focus", controleer);
      window.removeEventListener("storage", opOpslag);
      window.clearInterval(timer);
    };
  }, [melding, registreer, controleer]);

  if (melding === null) return null;

  if (melding.soort === "wachtOpOpslag") {
    const sessie = melding.reden === "sessie";
    return (
      <Modal onClose={sessie ? controleer : blijfAangemeld} label="Wijzigingen nog niet bewaard">
        <h2 className="auto-afmelden-titel">Wijzigingen nog niet bewaard</h2>
        <p className="auto-afmelden-tekst">
          {sessie
            ? "Je sessie is verlopen, maar niet al je wijzigingen staan al in de database. " +
              "Bevestig je login om ze alsnog te bewaren."
            : "Je was een tijdje niet actief, maar niet al je wijzigingen staan al in de database " +
              "(geen verbinding?). Daarom melden we je nog niet af: zodra alles bewaard is, " +
              "gebeurt dat automatisch."}
        </p>
        {bevestigFout && <p className="toegangspoort-fout">{bevestigFout}</p>}
        <div className="auto-afmelden-knoppen">
          <button type="button" className="knop-secundair" onClick={() => void meldAfMetBewaren()}>
            Toch afmelden
          </button>
          {sessie ? (
            <button type="button" className="knop-primair" onClick={() => void bevestig()}>
              Login bevestigen
            </button>
          ) : (
            <button type="button" className="knop-primair" onClick={blijfAangemeld}>
              Aangemeld blijven
            </button>
          )}
        </div>
      </Modal>
    );
  }

  const seconden = Math.ceil(melding.resterend / 1000);
  const tekst =
    seconden >= 60
      ? `${Math.floor(seconden / 60)}:${String(seconden % 60).padStart(2, "0")}`
      : `${seconden} seconden`;

  if (melding.soort === "sessie") {
    // Sluiten (Escape, klik ernaast) laat de melding gewoon terugkomen: de tijd loopt door.
    return (
      <Modal onClose={controleer} label="Bevestig je login">
        <h2 className="auto-afmelden-titel">Bevestig je login</h2>
        <p className="auto-afmelden-tekst">
          Je bent al een hele tijd aangemeld. Om de gegevens van leerlingen te beschermen moet je
          je login om de {MAX_SESSIE_MS / 3_600_000} uur bevestigen. Zonder bevestiging word je
          over <strong>{tekst}</strong> afgemeld. Je werk blijft gewoon staan.
        </p>
        {bevestigFout && <p className="toegangspoort-fout">{bevestigFout}</p>}
        <div className="auto-afmelden-knoppen">
          <button type="button" className="knop-secundair" onClick={() => void meldAfMetBewaren()}>
            Nu afmelden
          </button>
          <button type="button" className="knop-primair" onClick={() => void bevestig()}>
            Login bevestigen
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={blijfAangemeld} label="Ben je er nog?">
      <h2 className="auto-afmelden-titel">Ben je er nog?</h2>
      <p className="auto-afmelden-tekst">
        Je was een tijdje niet actief. Om de gegevens van leerlingen te beschermen word je over{" "}
        <strong>{tekst}</strong> automatisch afgemeld.
      </p>
      <div className="auto-afmelden-knoppen">
        <button type="button" className="knop-secundair" onClick={() => void meldAfMetBewaren()}>
          Nu afmelden
        </button>
        <button type="button" className="knop-primair" onClick={blijfAangemeld}>
          Aangemeld blijven
        </button>
      </div>
    </Modal>
  );
}
