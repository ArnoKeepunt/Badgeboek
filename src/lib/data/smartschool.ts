import { signInWithCustomToken } from "firebase/auth";
import { app, auth } from "./firebaseApp";
import { docsNaarStore, type DocData } from "./firestoreLayout";
import type { RauweStore } from "./persistentie";

/**
 * Leerling-login via Smartschool (OAuth). Het wachtwoord typt de leerling bij Smartschool zelf;
 * wij krijgen enkel een eenmalige code terug, die de functie `smartschoolAanmelden` (met het
 * client secret, dat enkel daar leeft) inruilt voor een Firebase-login. Zie
 * `functions/smartschool.js`.
 */

const PLATFORM = import.meta.env.VITE_SMARTSCHOOL_PLATFORM || "keerpunt.smartschool.be";
// Geen geheim (staat bij elke login gewoon in de adresbalk van Smartschool). Vast in de code omdat
// AI Studio de app bouwt zonder onze lokale `.env`. Het client secret staat enkel in de functie.
const CLIENT_ID = import.meta.env.VITE_SMARTSCHOOL_CLIENT_ID || "71f3dc7953bb";
/** Moet exact gelijk zijn aan de geregistreerde redirect-URI (en aan die in de functie). */
const REDIRECT_URI =
  import.meta.env.VITE_SMARTSCHOOL_REDIRECT_URI || "https://evaluatie.keerpuntscholen.be";
const STATE_SLEUTEL = "smartschool-state";

/** Staat de Smartschool-login aan (client id bekend)? */
export const SMARTSCHOOL_ACTIEF = CLIENT_ID !== "";

/** Naar de Smartschool-aanmeldpagina. `state` beschermt tegen een ondergeschoven terugkeer. */
export function startSmartschoolAanmelding(): void {
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_SLEUTEL, state);
  const url = new URL(`https://${PLATFORM}/OAuth`);
  url.search = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "userinfo",
    state,
  }).toString();
  window.location.assign(url.toString());
}

/** Komt deze pagina net terug van Smartschool (`?code=…` of `?error=…` in de URL)? */
export function isSmartschoolTerugkeer(): boolean {
  const p = new URLSearchParams(window.location.search);
  return p.has("state") && (p.has("code") || p.has("error"));
}

const callable = async <I, O>(naam: string) => {
  const { getFunctions, httpsCallable } = await import("firebase/functions");
  return httpsCallable<I, O>(getFunctions(app, "europe-west1"), naam);
};

/**
 * Verwerk de terugkeer van Smartschool: code inruilen en aanmelden. Haalt de parameters altijd
 * uit de adresbalk (ook bij een fout), zodat herladen niet opnieuw dezelfde code probeert.
 * Geeft een Nederlandse foutmelding terug, of `null` als het lukte.
 */
export async function verwerkSmartschoolTerugkeer(): Promise<string | null> {
  const p = new URLSearchParams(window.location.search);
  const code = p.get("code");
  const state = p.get("state");
  const verwacht = sessionStorage.getItem(STATE_SLEUTEL);
  sessionStorage.removeItem(STATE_SLEUTEL);
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash || "#/"}`);

  if (p.has("error")) return "Aanmelden bij Smartschool werd geannuleerd of geweigerd.";
  if (!code || !state || state !== verwacht) {
    return "Deze aanmelding kon niet gecontroleerd worden. Probeer opnieuw.";
  }
  try {
    const aanmelden = await callable<{ code: string }, { token: string }>("smartschoolAanmelden");
    const { data } = await aanmelden({ code });
    await signInWithCustomToken(auth, data.token);
    return null;
  } catch (err) {
    const fout = err as { code?: string; message?: string };
    if (fout.code === "functions/not-found" && fout.message) return fout.message;
    return "Aanmelden met Smartschool is niet gelukt. Probeer opnieuw.";
  }
}

/** De afgeschermde leerlingweergave (enkel eigen gegevens), als store-stand. */
export async function haalLeerlingweergave(): Promise<RauweStore> {
  const ophalen = await callable<void, { docs: Record<string, DocData> }>("mijnBadgeboek");
  const { data } = await ophalen();
  return docsNaarStore(new Map(Object.entries(data.docs)));
}

/** De leerling opende zijn meldingen — ook in de database bijhouden. */
export async function bewaarMeldingenGezien(): Promise<void> {
  const gezien = await callable<void, { ok: boolean }>("mijnMeldingenGezien");
  await gezien();
}
