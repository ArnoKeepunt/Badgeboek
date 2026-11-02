import keerpuntLogo from "../assets/keerpunt-logo.png";
import { PERSISTENTIE_MODUS } from "./data";
import { rapportBestandsnaam } from "./rapportInhoud";
import type { Rapport, Rubriek, Student } from "./types";

/**
 * Een rapport als pdf-bestand: de app stuurt de printweergave (`RapportPrint` + de eigen CSS) als
 * één HTML-document naar de serverfunctie `rapportPdf` (functions/index.js), die het met Chrome
 * afdrukt — exact wat "Printen" geeft, dus één ontwerp. Een pdf-bibliotheek in de browser
 * (@react-pdf) bleek een benadering: minder scherp, verschoven, en z'n browserbuild brak op
 * regelafstand.
 *
 * Enkel in firebase-modus (de functie vraagt een aangemeld personeelslid). In local-modus valt de
 * app terug op het printvenster.
 */
export const PDF_SERVER_ACTIEF = PERSISTENTIE_MODUS === "firebase";

let logoBelofte: Promise<string> | null = null;
/** Het logo als `data:`-URI — de server laadt niets van buiten. */
function logoAlsData(): Promise<string> {
  logoBelofte ??= fetch(keerpuntLogo)
    .then((r) => r.blob())
    .then(
      (b) =>
        new Promise<string>((ok, fout) => {
          const lezer = new FileReader();
          lezer.onload = () => ok(String(lezer.result));
          lezer.onerror = () => fout(lezer.error);
          lezer.readAsDataURL(b);
        }),
    );
  logoBelofte.catch(() => (logoBelofte = null));
  return logoBelofte;
}

/**
 * Alle CSS van de app als tekst, zonder de `@font-face`-regels (relatieve URL's die de server niet
 * kan laden; de functie voegt het lettertype zelf toe).
 */
function appCss(): string {
  const delen: string[] = [];
  for (const blad of Array.from(document.styleSheets)) {
    let regels: CSSRuleList;
    try {
      regels = blad.cssRules;
    } catch {
      continue; // stylesheet van een ander domein (bv. een extensie): niet leesbaar, niet nodig
    }
    for (const regel of Array.from(regels)) {
      if (!(regel instanceof CSSFontFaceRule)) delen.push(regel.cssText);
    }
  }
  return delen.join("\n");
}

async function rapportHtml(student: Student, rapport: Rapport, rubrieken: Rubriek[]) {
  const [{ renderToStaticMarkup }, { RapportPrint }, logo] = await Promise.all([
    import("react-dom/server"),
    import("../components/RapportPrint"),
    logoAlsData(),
  ]);
  const inhoud = renderToStaticMarkup(
    <RapportPrint student={student} rapport={rapport} rubrieken={rubrieken} logo={logo} />,
  );
  return (
    `<!doctype html><html lang="nl"><head><meta charset="utf-8">` +
    `<title>${rapportBestandsnaam(rapport, student)}</title><style>${appCss()}</style></head>` +
    `<body>${inhoud}</body></html>`
  );
}

function base64NaarPdf(b64: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "application/pdf" });
}

/** Het rapport van één leerling als pdf (via de serverfunctie). */
export async function maakRapportPdf(
  student: Student,
  rapport: Rapport,
  rubrieken: Rubriek[],
): Promise<Blob> {
  const [{ getFunctions, httpsCallable }, { app }, html] = await Promise.all([
    import("firebase/functions"),
    import("./data/firebaseApp"),
    rapportHtml(student, rapport, rubrieken),
  ]);
  const maak = httpsCallable<{ html: string }, { pdf: string }>(
    getFunctions(app, "europe-west1"),
    "rapportPdf",
    // De eerste aanroep na een pauze start Chrome op de server (±10 s).
    { timeout: 130_000 },
  );
  const { data } = await maak({ html });
  return base64NaarPdf(data.pdf);
}

/** Zoveel pdf's tegelijk bij de zip: sneller dan één voor één, zonder de server te overspoelen. */
const GELIJKTIJDIG = 3;

/**
 * Eén zip met per leerling een eigen pdf (bulkexport op `/rapport`). Bestandsnamen volgens
 * `rapportBestandsnaam`; komt een naam twee keer voor (zelfde naam in dezelfde vestiging), dan
 * krijgt de tweede " (2)" erbij i.p.v. de eerste te overschrijven.
 */
export async function maakRapportenZip(
  items: { student: Student; rapport: Rapport }[],
  rubrieken: Rubriek[],
  opVoortgang?: (klaar: number, totaal: number) => void,
): Promise<Blob> {
  const { zipSync } = await import("fflate");
  const pdfs: Uint8Array[] = new Array(items.length);
  let klaar = 0;
  let volgende = 0;
  const werker = async () => {
    while (volgende < items.length) {
      const i = volgende++;
      const blob = await maakRapportPdf(items[i].student, items[i].rapport, rubrieken);
      pdfs[i] = new Uint8Array(await blob.arrayBuffer());
      opVoortgang?.(++klaar, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(GELIJKTIJDIG, items.length) }, werker));

  const bestanden: Record<string, Uint8Array> = {};
  items.forEach(({ student, rapport }, i) => {
    const basis = rapportBestandsnaam(rapport, student);
    let naam = `${basis}.pdf`;
    for (let n = 2; naam in bestanden; n++) naam = `${basis} (${n}).pdf`;
    bestanden[naam] = pdfs[i];
  });
  // Pdf's zijn al gecomprimeerd: enkel opslaan (level 0) is sneller en amper groter.
  return new Blob([zipSync(bestanden, { level: 0 })], { type: "application/zip" });
}
