import { useSyncExternalStore } from "react";
import type { User } from "firebase/auth";
import { PERSISTENTIE_MODUS, abonneerAuth, abonneerGebruiker } from "./data";
import { zetFirebaseBereik } from "./data/firebaseBereik";
import type { Personeelslid } from "./gebruikers";
import { heeftDevToegang, isBootstrapAdmin } from "./gebruikers";
import { wisLeerlingweergave, zetFirebaseActor } from "./store";

/**
 * Eén module-brede bron voor "wie is er aangemeld bij Firebase" + "welk personeelsaccount
 * hoort daarbij" (`gebruikers/{email}` in Firestore). Één auth-luisteraar + één
 * doc-luisteraar voor de hele app, i.p.v. per component.
 */
export interface AuthStatus {
  /** De Firebase-gebruiker, of `null` (niet aangemeld / local-modus). */
  gebruiker: User | null;
  /** Het personeelsaccount van die gebruiker, of `null` (geen account / local-modus). */
  persoon: Personeelslid | null;
  /**
   * Aangemeld als leerling (via Smartschool): de leerling-id uit het custom token. Zo'n account
   * heeft geen e-mailadres en geen personeelsaccount; Firestore zelf blijft dicht, de gegevens
   * komen uit de functie `mijnBadgeboek` (zie `data/smartschool.ts`).
   */
  leerlingId: string | null;
  /** `true` zolang de auth-status of het account nog opgehaald wordt. */
  laden: boolean;
}

let status: AuthStatus = {
  gebruiker: null,
  persoon: null,
  leerlingId: null,
  laden: PERSISTENTIE_MODUS === "firebase",
};

const luisteraars = new Set<() => void>();
const meld = () => luisteraars.forEach((fn) => fn());

let stopPersoon: (() => void) | null = null;

if (PERSISTENTIE_MODUS === "firebase") {
  abonneerAuth((u) => {
    stopPersoon?.();
    stopPersoon = null;
    zetFirebaseActor(null);
    zetFirebaseBereik(null);
    // Een leerling meldde af (of de sessie verliep): zijn gegevens en "leerling-sessie" mogen
    // niet blijven hangen voor wie zich daarna in dit tabblad aanmeldt.
    if (status.leerlingId) wisLeerlingweergave();

    if (u && !u.email) {
      status = { gebruiker: u, persoon: null, leerlingId: null, laden: true };
      meld();
      void u
        .getIdTokenResult()
        .then((t) => (t.claims.rol === "leerling" ? String(t.claims.leerlingId ?? "") : ""))
        .catch(() => "")
        .then((leerlingId) => {
          if (status.gebruiker !== u) return; // ondertussen afgemeld/gewisseld
          status = { gebruiker: u, persoon: null, leerlingId: leerlingId || null, laden: false };
          meld();
        });
    } else if (u?.email) {
      status = { gebruiker: u, persoon: null, leerlingId: null, laden: true };
      meld();
      stopPersoon = abonneerGebruiker(u.email, (p) => {
        status = { ...status, persoon: p, laden: false };
        // Zo weet de wijzigingsgeschiedenis wie de evaluatie ingaf (id = e-mailadres).
        zetFirebaseActor(
          p && p.actief && u.email ? { id: u.email, naam: p.naam || u.email } : null,
        );
        // Welke vestigingen mogen de Firestore-queries ophalen? Beheerder/coördinator +
        // bootstrap-admin: alles. Mentor: enkel de eigen vestigingen. Anders: niets.
        zetFirebaseBereik(
          isBootstrapAdmin(u.email)
            ? { alles: true, vestigingen: [], beheerder: true }
            : p?.actief
              ? {
                  alles: p.rol === "beheerder" || p.rol === "coordinator",
                  vestigingen: p.vestigingen,
                  beheerder: p.rol === "beheerder",
                }
              : { alles: false, vestigingen: [], beheerder: false },
        );
        meld();
      });
    } else {
      status = { gebruiker: u, persoon: null, leerlingId: null, laden: false };
      meld();
    }
  });
}

const subscribe = (fn: () => void) => {
  luisteraars.add(fn);
  return () => luisteraars.delete(fn);
};
const snapshot = () => status;

/** De volledige auth-status (Firebase-gebruiker + personeelsaccount + laadstatus). */
export function useAuthStatus(): AuthStatus {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Alleen de Firebase-gebruiker + laadstatus (voor de toegangspoort). */
export function useFirebaseGebruiker(): { gebruiker: User | null; laden: boolean } {
  const s = useAuthStatus();
  return { gebruiker: s.gebruiker, laden: s.laden };
}

/** Het personeelsaccount van de aangemelde gebruiker + laadstatus. */
export function useHuidigPersoneelslid(): { persoon: Personeelslid | null; laden: boolean } {
  const s = useAuthStatus();
  return { persoon: s.persoon, laden: s.laden };
}

/**
 * Mag de huidige gebruiker de dev-acties (verwijderen van vestigingen/accounts, curriculum
 * wissen, database opruimen, …)? = local-modus, de bootstrap-beheerder, of de `dev`-vlag.
 * Een gewone beheerder kan wél deactiveren, niet verwijderen.
 */
export function useDevToegang(): boolean {
  const s = useAuthStatus();
  return PERSISTENTIE_MODUS !== "firebase" || heeftDevToegang(s.persoon, s.gebruiker?.email);
}

/**
 * Een geverifieerd Keerpunt-account. Spiegelt de domeincheck; de échte toegangscontrole is het
 * personeelsaccount + de Firestore-regels.
 */
export function isKeerpuntAccount(u: User | null): boolean {
  return Boolean(u?.emailVerified) && /@keerpuntscholen\.be$/i.test(u?.email ?? "");
}

/** Mag deze gebruiker de app in? Actief personeelsaccount of het noodluik-adres. */
export function heeftToegang(s: AuthStatus): boolean {
  if (!s.gebruiker || !isKeerpuntAccount(s.gebruiker)) return false;
  return isBootstrapAdmin(s.gebruiker.email) || Boolean(s.persoon?.actief);
}
