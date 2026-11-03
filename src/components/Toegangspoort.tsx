import { type ReactNode, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { PERSISTENTIE_MODUS, meldAanMetGoogle, meldAfVanFirebase, sessieBeginVan } from "../lib/data";
import { heeftToegang, isKeerpuntAccount, useAuthStatus } from "../lib/firebaseAuth";
import { MAX_SESSIE_MS, leesAfmeldReden, zetAfmeldReden } from "../lib/inactiviteit";
import { useGesynct } from "../lib/opslagStatus";
import {
  SMARTSCHOOL_ACTIEF,
  haalLeerlingweergave,
  isSmartschoolTerugkeer,
  startSmartschoolAanmelding,
  verwerkSmartschoolTerugkeer,
} from "../lib/data/smartschool";
import { zetLeerlingweergave } from "../lib/store";
import { AutoAfmelden } from "./AutoAfmelden";

/**
 * Toegangspoort: in firebase-modus moet je je eerst aanmelden — personeel met een geverifieerd
 * `@keerpuntscholen.be` Google-account, leerlingen met Smartschool. Pas dan verschijnt de app.
 * In local-modus (geen Firebase Auth) is er geen poort.
 */
export function Toegangspoort({ children }: { children: ReactNode }) {
  if (PERSISTENTIE_MODUS !== "firebase") return <>{children}</>;
  return <FirebasePoort>{children}</FirebasePoort>;
}

/**
 * Is de sessie van deze gebruiker verlopen (langer dan `MAX_SESSIE_MS` sinds de laatste echte
 * login)? `null` zolang dat nog niet gekend is. Een verlopen sessie wordt meteen afgemeld.
 *
 * Moet vóór de accountcontrole: bij een verlopen sessie weigert de database ook het eigen
 * account, en dan zou de poort "Je hebt nog geen toegang" tonen in plaats van "sessie verlopen".
 */
function useSessieVerlopen(gebruiker: User | null): boolean | null {
  const [gecontroleerd, setGecontroleerd] = useState<{ uid: string; verlopen: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (!gebruiker) return;
    let actief = true;
    sessieBeginVan(gebruiker)
      .then((begin) => Date.now() >= begin + MAX_SESSIE_MS)
      .catch(() => false) // token onleesbaar: dan beslist de Firestore-regel
      .then((verlopen) => {
        if (!actief) return;
        setGecontroleerd({ uid: gebruiker.uid, verlopen });
        if (verlopen) {
          zetAfmeldReden("sessie");
          void meldAfVanFirebase();
        }
      });
    return () => {
      actief = false;
    };
  }, [gebruiker]);

  if (!gebruiker) return false;
  return gecontroleerd?.uid === gebruiker.uid ? gecontroleerd.verlopen : null;
}

function FirebasePoort({ children }: { children: ReactNode }) {
  const status = useAuthStatus();
  const sessieVerlopen = useSessieVerlopen(status.gebruiker);
  const gesynct = useGesynct();

  // Een verlopen sessie wordt net afgemeld: niets tonen tot het inlogscherm verschijnt.
  if (status.laden || sessieVerlopen !== false) {
    return (
      <PoortScherm>
        <p className="toegangspoort-tekst">Even geduld…</p>
      </PoortScherm>
    );
  }
  if (!status.gebruiker) return <Inloggen />;
  if (status.leerlingId) {
    return (
      <>
        <AutoAfmelden gebruiker={status.gebruiker} leerling />
        <LeerlingGegevens leerlingId={status.leerlingId}>{children}</LeerlingGegevens>
      </>
    );
  }
  // Een leerling die het met zijn Google-adres (`….leerling@keerpuntscholen.be`) probeert.
  if (/\.leerling@keerpuntscholen\.be$/i.test(status.gebruiker.email ?? "")) {
    return <GeenToegang gebruiker={status.gebruiker} reden="leerling" />;
  }
  if (!isKeerpuntAccount(status.gebruiker)) {
    return <GeenToegang gebruiker={status.gebruiker} reden="domein" />;
  }
  if (!heeftToegang(status)) return <GeenToegang gebruiker={status.gebruiker} reden="account" />;
  return (
    <>
      <AutoAfmelden gebruiker={status.gebruiker} />
      {gesynct ? children : <GegevensLaden />}
    </>
  );
}

/** Bij terugkeren naar het tabblad hooguit zo vaak opnieuw ophalen. */
const LEERLING_VERVERS_MS = 60_000;

/**
 * Een leerling leest Firestore niet zelf: de functie `mijnBadgeboek` geeft enkel zijn eigen
 * gegevens. Opgehaald bij het openen en opnieuw wanneer het tabblad weer zichtbaar wordt.
 */
function LeerlingGegevens({ leerlingId, children }: { leerlingId: string; children: ReactNode }) {
  const [klaar, setKlaar] = useState(false);
  const [fout, setFout] = useState(false);
  const [poging, setPoging] = useState(0);

  useEffect(() => {
    let actief = true;
    let laatste = 0;
    const haal = () => {
      laatste = Date.now();
      haalLeerlingweergave()
        .then((rauw) => {
          if (!actief) return;
          zetLeerlingweergave(rauw, leerlingId);
          setKlaar(true);
          setFout(false);
        })
        .catch((err) => {
          console.warn("Leerlinggegevens ophalen mislukt:", err);
          if (actief) setFout(true);
        });
    };
    const opZichtbaar = () => {
      if (document.visibilityState === "visible" && Date.now() - laatste > LEERLING_VERVERS_MS) {
        haal();
      }
    };
    haal();
    document.addEventListener("visibilitychange", opZichtbaar);
    return () => {
      actief = false;
      document.removeEventListener("visibilitychange", opZichtbaar);
    };
  }, [leerlingId, poging]);

  if (klaar) return <>{children}</>;
  return (
    <PoortScherm>
      {fout ? (
        <>
          <p className="toegangspoort-fout">
            Je gegevens konden niet geladen worden. Controleer je verbinding en probeer opnieuw.
          </p>
          <button
            type="button"
            className="knop-primair toegangspoort-knop"
            onClick={() => setPoging((p) => p + 1)}
          >
            Opnieuw proberen
          </button>
          <button
            type="button"
            className="knop-secundair toegangspoort-knop"
            onClick={() => void meldAfVanFirebase()}
          >
            Afmelden
          </button>
        </>
      ) : (
        <p className="toegangspoort-tekst">Gegevens laden…</p>
      )}
    </PoortScherm>
  );
}

/**
 * De terugkeer van Smartschool (`?code=…`) één keer verwerken, ook als het inlogscherm twee keer
 * mount (StrictMode): de code is eenmalig bruikbaar.
 */
let smartschoolTerugkeer: Promise<string | null> | null = null;

/** Na zoveel tijd zonder eerste snapshot zeggen we dat er iets mis lijkt. */
const LADEN_TRAAG_MS = 15_000;

/**
 * Tot de eerste volledige snapshot binnen is, blijft de app dicht: de lokale cache kan dagen
 * oud zijn, en wie daarop bewerkt, overschrijft bij het bewaren het werk van collega's.
 */
function GegevensLaden() {
  const [traag, setTraag] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setTraag(true), LADEN_TRAAG_MS);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <PoortScherm>
      <p className="toegangspoort-tekst">Gegevens laden…</p>
      {traag && (
        <>
          <p className="toegangspoort-fout">
            Het laden duurt ongewoon lang. Controleer je verbinding en probeer opnieuw.
          </p>
          <button
            type="button"
            className="knop-primair toegangspoort-knop"
            onClick={() => window.location.reload()}
          >
            Opnieuw laden
          </button>
        </>
      )}
    </PoortScherm>
  );
}

function PoortScherm({ children }: { children: ReactNode }) {
  return (
    <div className="toegangspoort">
      <div className="toegangspoort-kaart">
        {/* Het Keerpunt-logo = hetzelfde beeld als het favicon (public/). */}
        <img className="toegangspoort-logo" src="/keerpunt-favicon.png" alt="Keerpunt" />
        <h1 className="toegangspoort-titel">Badgeboek</h1>
        {children}
      </div>
    </div>
  );
}

function GoogleIcoon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 5c1.56 0 2.98.54 4.1 1.6l3.07-3.07C17.3 1.8 14.85 1 12 1 7.5 1 3.65 3.6 1.8 7.37l3.75 2.91C6.46 7.4 9 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.07-1.55-.2-2.3H12v4.5h6.5c-.28 1.5-1.12 2.8-2.4 3.65l3.7 2.88c2.16-2 3.7-4.93 3.7-8.73z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.72c-.24-.72-.37-1.49-.37-2.72s.13-2 .37-2.72L1.8 6.37C.65 8.65 0 10.25 0 12s.65 3.35 1.8 5.63l3.75-2.91z"
      />
      <path
        fill="#34A853"
        d="M12 23c3.24 0 5.96-1.08 7.95-2.93l-3.7-2.88c-1.08.73-2.46 1.16-4.25 1.16-3 0-5.54-2.4-6.45-5.28L1.8 15.98C3.65 19.75 7.5 23 12 23z"
      />
    </svg>
  );
}

function SmartschoolIcoon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5zM7 11.5V16c0 1.4 2.2 3 5 3s5-1.6 5-3v-4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Twee aparte inlogschermen, om misverstanden te vermijden:
 * - de gewone link (`/`) = **leerlingen en ouders**, enkel Smartschool. Moet de site-root zijn:
 *   daar stuurt Smartschool na het aanmelden naar terug (de geregistreerde redirect-URI).
 * - `/?personeel` = **personeel**, enkel Google (`@keerpuntscholen.be`).
 * Onderaan elk scherm een discreet linkje naar het andere. Zonder Smartschool (bv. local-modus
 * of geen client id) is er enkel het personeelsscherm.
 */
const PERSONEEL_PARAM = "personeel";
const isPersoneelsScherm = () =>
  !SMARTSCHOOL_ACTIEF || new URLSearchParams(window.location.search).has(PERSONEEL_PARAM);

function Inloggen() {
  const [laden, setLaden] = useState(false);
  const [smartschoolBezig, setSmartschoolBezig] = useState(isSmartschoolTerugkeer);
  const [fout, setFout] = useState("");
  const [afmeldReden] = useState(leesAfmeldReden);
  const personeel = isPersoneelsScherm();

  useEffect(() => {
    if (!smartschoolTerugkeer && !isSmartschoolTerugkeer()) return;
    smartschoolTerugkeer ??= verwerkSmartschoolTerugkeer();
    let actief = true;
    void smartschoolTerugkeer.then((melding) => {
      smartschoolTerugkeer = null;
      if (!actief) return;
      // Gelukt: de auth-luisteraar neemt over (deze component verdwijnt).
      if (melding) setFout(melding);
      setSmartschoolBezig(false);
    });
    return () => {
      actief = false;
    };
  }, []);

  const aanmelden = async () => {
    setLaden(true);
    setFout("");
    zetAfmeldReden(null);
    try {
      await meldAanMetGoogle();
    } catch (err) {
      const code = err instanceof Error && "code" in err ? String((err as { code: unknown }).code) : "";
      setFout(
        code === "auth/unauthorized-domain"
          ? "Dit domein staat nog niet bij de toegestane domeinen in de Firebase-console (Authentication → Settings)."
          : "Aanmelden met Google is niet gelukt. Probeer opnieuw.",
      );
    } finally {
      setLaden(false);
    }
  };

  if (smartschoolBezig) {
    return (
      <PoortScherm>
        <p className="toegangspoort-tekst">Aanmelden met Smartschool…</p>
      </PoortScherm>
    );
  }

  const melding = afmeldReden && (
    <p className="toegangspoort-melding">
      {afmeldReden === "sessie"
        ? "Je sessie is verlopen. Meld je opnieuw aan om verder te werken."
        : "Je werd automatisch afgemeld omdat je een tijdje niet actief was."}
    </p>
  );

  if (personeel) {
    return (
      <PoortScherm>
        <p className="toegangspoort-voor">Personeel</p>
        {melding}
        <p className="toegangspoort-tekst">
          Meld je aan met je Keerpunt-account (<code>@keerpuntscholen.be</code>).
        </p>
        {fout && <p className="toegangspoort-fout">{fout}</p>}
        <button
          type="button"
          className="knop-primair toegangspoort-knop"
          onClick={aanmelden}
          disabled={laden}
        >
          <GoogleIcoon />
          {laden ? "Aanmelden…" : "Aanmelden met Google"}
        </button>
        {SMARTSCHOOL_ACTIEF && (
          <p className="toegangspoort-wissel">
            Leerling of ouder? <a href="/">Ga naar de aanmelding voor leerlingen</a>
          </p>
        )}
      </PoortScherm>
    );
  }

  return (
    <PoortScherm>
      <p className="toegangspoort-voor">Leerlingen en ouders</p>
      {melding}
      <p className="toegangspoort-tekst">
        Meld je aan met je Smartschool-gebruikersnaam en -wachtwoord. Ouders gebruiken hun
        co-account: de gebruikersnaam van hun kind met hun eigen wachtwoord.
      </p>
      {fout && <p className="toegangspoort-fout">{fout}</p>}
      <button
        type="button"
        className="knop-primair toegangspoort-knop"
        onClick={() => {
          zetAfmeldReden(null);
          startSmartschoolAanmelding();
        }}
      >
        <SmartschoolIcoon />
        Aanmelden met Smartschool
      </button>
      <p className="toegangspoort-wissel">
        Personeel? <a href={`/?${PERSONEEL_PARAM}`}>Aanmelden met je Keerpunt-account</a>
      </p>
    </PoortScherm>
  );
}

function GeenToegang({
  gebruiker,
  reden,
}: {
  gebruiker: User;
  reden: "domein" | "account" | "leerling";
}) {
  return (
    <PoortScherm>
      <p className="toegangspoort-tekst">
        Je bent aangemeld als <strong>{gebruiker.email ?? gebruiker.displayName}</strong>.{" "}
        {reden === "leerling" ? (
          <>
            Dat is een leerlingenaccount. Leerlingen (en ouders) melden zich aan met Smartschool.
          </>
        ) : reden === "domein" ? (
          <>
            Dat account hoort niet bij Keerpunt (<code>@keerpuntscholen.be</code>). Meld je aan
            met je Keerpunt-account.
          </>
        ) : (
          <>
            Je hebt nog geen toegang tot het Badgeboek. Vraag een beheerder om je toe te voegen.
          </>
        )}
      </p>
      <button
        type="button"
        className="knop-primair toegangspoort-knop"
        onClick={() =>
          void meldAfVanFirebase().then(() => {
            // Naar het leerlingenscherm, zodat de Smartschool-knop meteen klaarstaat.
            if (reden === "leerling") window.location.assign("/");
          })
        }
      >
        {reden === "leerling" ? "Afmelden en aanmelden met Smartschool" : "Afmelden"}
      </button>
    </PoortScherm>
  );
}
