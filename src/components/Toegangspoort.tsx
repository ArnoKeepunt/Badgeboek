import { type ReactNode, useState } from "react";
import type { User } from "firebase/auth";
import { PERSISTENTIE_MODUS, meldAanMetGoogle, meldAfVanFirebase } from "../lib/data";
import { heeftToegang, isKeerpuntAccount, useAuthStatus } from "../lib/firebaseAuth";
import { LogoIcoon } from "./LogoIcoon";

/**
 * Toegangspoort: in firebase-modus moet je je eerst aanmelden met een geverifieerd
 * `@keerpuntscholen.be` Google-account. Pas dan verschijnt de app. In local-modus (geen
 * Firebase Auth) is er geen poort.
 */
export function Toegangspoort({ children }: { children: ReactNode }) {
  if (PERSISTENTIE_MODUS !== "firebase") return <>{children}</>;
  return <FirebasePoort>{children}</FirebasePoort>;
}

function FirebasePoort({ children }: { children: ReactNode }) {
  const status = useAuthStatus();

  if (status.laden) {
    return (
      <PoortScherm>
        <p className="toegangspoort-tekst">Even geduld…</p>
      </PoortScherm>
    );
  }
  if (!status.gebruiker) return <Inloggen />;
  if (!isKeerpuntAccount(status.gebruiker)) {
    return <GeenToegang gebruiker={status.gebruiker} reden="domein" />;
  }
  if (!heeftToegang(status)) return <GeenToegang gebruiker={status.gebruiker} reden="account" />;
  return <>{children}</>;
}

function PoortScherm({ children }: { children: ReactNode }) {
  return (
    <div className="toegangspoort">
      <div className="toegangspoort-kaart">
        <LogoIcoon className="toegangspoort-logo" />
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

function Inloggen() {
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState("");

  const aanmelden = async () => {
    setLaden(true);
    setFout("");
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

  return (
    <PoortScherm>
      <p className="toegangspoort-tekst">
        Meld je aan met je Keerpunt-account (<code>@keerpuntscholen.be</code>) om verder te gaan.
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
    </PoortScherm>
  );
}

function GeenToegang({ gebruiker, reden }: { gebruiker: User; reden: "domein" | "account" }) {
  return (
    <PoortScherm>
      <p className="toegangspoort-tekst">
        Je bent aangemeld als <strong>{gebruiker.email ?? gebruiker.displayName}</strong>.{" "}
        {reden === "domein" ? (
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
        onClick={() => void meldAfVanFirebase()}
      >
        Afmelden
      </button>
    </PoortScherm>
  );
}
