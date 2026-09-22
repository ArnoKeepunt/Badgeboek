/**
 * Rechtstreekse pdf-download van een rapport ("Opslaan als pdf" in `RapportDetail.tsx`) —
 * neemt letterlijk dezelfde `.rapport-print`-DOM/CSS als de browser-printweergave (Ctrl/Cmd+P),
 * zodat beide **exact dezelfde opmaak** geven. Eerder bouwde dit een los pdf-document op uit
 * ruwe data (`jspdf-autotable`), maar dat zag er anders uit dan de printweergave — dat was niet
 * de bedoeling.
 *
 * `jspdf` (met de ingebouwde `html2canvas`) wordt **dynamisch** geïmporteerd (`import()`): enkel
 * wie effectief op "Opslaan als pdf" klikt laadt die paar honderd kB mee, niet iedereen die het
 * rapport gewoon bekijkt/invult.
 */

const A4_BREEDTE_PT = 595.28; // A4 (format: "a4" hieronder) in punten, staand
const MARGE_PT = 28;

/**
 * @param element De `.rapport-print`-DOM-node. Moet op het moment van de aanroep écht zichtbaar/
 *   gelayout zijn (niet `display: none`) — `RapportDetail.tsx` zet er even
 *   `.rapport-print--pdf-render` op (buiten beeld, vaste breedte) vóór deze aanroep.
 * @param bestandsnaam Zonder extensie — dit bestand voegt zelf ".pdf" toe.
 */
export async function downloadRapportPdf(element: HTMLElement, bestandsnaam: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await doc.html(element, {
    margin: [MARGE_PT, MARGE_PT, MARGE_PT, MARGE_PT],
    autoPaging: "text",
    width: A4_BREEDTE_PT - 2 * MARGE_PT,
    windowWidth: element.scrollWidth || 800,
  });
  doc.save(`${bestandsnaam}.pdf`);
}
