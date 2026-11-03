import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import chromium from "@sparticuz/chromium";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import puppeteer from "puppeteer-core";

/**
 * `rapportPdf`: maakt van de printweergave van een rapport (`RapportPrint` + de CSS van de app,
 * door de app als één HTML-document meegestuurd) een pdf met Chrome — exact wat "Printen" in de
 * browser geeft, dus één ontwerp voor printen, "Opslaan als pdf", de zip en het archief.
 *
 * - Enkel actief personeel (zelfde controle als `isPersoneel()` in firestore.rules, incl. de
 *   maximale sessieduur van 12 uur).
 * - Chrome laadt niets van buiten: enkel `data:`-URI's (logo en lettertype zitten in de HTML of
 *   hieronder). Zo kan de meegestuurde HTML nergens naartoe bellen.
 * - Het lettertype (Inter) zit in de functie zelf: op de server bestaan de systeemlettertypes van
 *   een Mac/Windows niet, en het rapport gebruikt in de app ook Inter.
 */

initializeApp();
// De app gebruikt een *named* Firestore-database (zie firebase.json), niet "(default)".
const db = getFirestore("ai-studio-badgeboek-af2ee9df-cd5d-4667-a2f9-b3c45c821be9");

const BOOTSTRAP_ADMIN = "arno.boriau@keerpuntscholen.be";
const PERSONEELSROLLEN = ["beheerder", "coordinator", "mentor", "extern"];
const MAX_SESSIE_S = 12 * 3600;
const MAX_HTML = 3_000_000;

async function isPersoneel(auth) {
  const token = auth?.token;
  const email = token?.email;
  if (!email || token.email_verified !== true) return false;
  if (!/@keerpuntscholen\.be$/i.test(email)) return false;
  if (Date.now() / 1000 > (token.auth_time ?? 0) + MAX_SESSIE_S) return false;
  if (email === BOOTSTRAP_ADMIN) return true;
  const doc = await db.doc(`gebruikers/${email}`).get();
  return doc.exists && doc.get("actief") === true && PERSONEELSROLLEN.includes(doc.get("rol"));
}

const require = createRequire(import.meta.url);
const fontData = (bestand) =>
  readFileSync(require.resolve(`@fontsource/inter/files/${bestand}`)).toString("base64");
/** Achteraan in de pagina: wint van de @font-face-regels van de app (relatieve URL's, onbereikbaar hier). */
const LETTERTYPE_CSS = [
  ["400", "normal", "inter-latin-400-normal.woff2"],
  ["400", "italic", "inter-latin-400-italic.woff2"],
  ["600", "normal", "inter-latin-600-normal.woff2"],
  ["700", "normal", "inter-latin-700-normal.woff2"],
]
  .map(
    ([gewicht, stijl, bestand]) =>
      `@font-face{font-family:"Inter";font-weight:${gewicht};font-style:${stijl};` +
      `src:url(data:font/woff2;base64,${fontData(bestand)}) format("woff2");}`,
  )
  .join("\n");

/** Eén Chrome per (warme) instantie, hergebruikt tussen aanroepen. */
let browserBelofte = null;
async function geefBrowser() {
  if (browserBelofte) {
    const b = await browserBelofte.catch(() => null);
    if (b?.connected) return b;
  }
  // Lokaal testen: CHROME_PAD naar een gewone Chrome — de chromium-binary én z'n opstartopties
  // (o.a. --single-process) zijn enkel voor de Linux-server.
  const lokaal = process.env.CHROME_PAD;
  browserBelofte = puppeteer.launch({
    args: lokaal ? [] : chromium.args,
    executablePath: lokaal || (await chromium.executablePath()),
    headless: "shell",
  });
  return browserBelofte;
}

/** HTML → pdf-bytes. Los geëxporteerd om lokaal te kunnen testen zonder de auth eromheen. */
export async function htmlNaarPdf(html) {
  const browser = await geefBrowser();
  const page = await browser.newPage();
  try {
    await page.setRequestInterception(true);
    page.on("request", (r) => {
      const url = r.url();
      if (url.startsWith("data:") || url === "about:blank") void r.continue();
      else void r.abort();
    });
    const metLettertype = html.includes("</head>")
      ? html.replace("</head>", `<style>${LETTERTYPE_CSS}</style></head>`)
      : `<style>${LETTERTYPE_CSS}</style>${html}`;
    await page.setContent(metLettertype, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    // Bladgrootte en marges komen uit de `@page`-regel van de app — net als bij "Printen".
    return await page.pdf({ printBackground: true, preferCSSPageSize: true });
  } finally {
    await page.close();
  }
}

export const rapportPdf = onCall(
  {
    region: "europe-west1",
    memory: "2GiB",
    timeoutSeconds: 120,
    // Eén pdf tegelijk per instantie: Chrome is zwaar; bij drukte schaalt het op.
    concurrency: 1,
    maxInstances: 5,
  },
  async (request) => {
    if (!(await isPersoneel(request.auth))) {
      throw new HttpsError("permission-denied", "Enkel personeel kan rapport-pdf's maken.");
    }
    const html = request.data?.html;
    if (typeof html !== "string" || html.length === 0 || html.length > MAX_HTML) {
      throw new HttpsError("invalid-argument", "Ongeldige rapportweergave.");
    }
    const pdf = await htmlNaarPdf(html);
    return { pdf: Buffer.from(pdf).toString("base64") };
  },
);

// Leerling-login via Smartschool + de afgeschermde leerlingweergave.
export { mijnBadgeboek, mijnMeldingenGezien, smartschoolAanmelden } from "./smartschool.js";
