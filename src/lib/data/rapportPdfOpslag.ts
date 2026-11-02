import { app } from "./firebaseApp";

/**
 * Een afgewerkt rapport als pdf in Firebase Storage bewaren: `rapporten/{rapportId}/{tijd}.pdf`.
 * Elke versie is een nieuw bestand — de regels (`storage.rules`) laten enkel aanmaken toe, nooit
 * overschrijven of wissen. Lezen gaat via de download-link (met token) die in het rapport-doc
 * komt; zo bepalen de Firestore-regels van `rapporten` wie de pdf te zien krijgt.
 *
 * `firebase/storage` pas hier laden (dynamisch): enkel wie een rapport afwerkt, heeft het nodig.
 */
export async function uploadRapportPdf(
  rapportId: string,
  pdf: Blob,
): Promise<{ pad: string; url: string; op: number }> {
  const { getStorage, getDownloadURL, ref, uploadBytes } = await import("firebase/storage");
  const op = Date.now();
  const pad = `rapporten/${rapportId}/${op}.pdf`;
  const bestand = ref(getStorage(app), pad);
  await uploadBytes(bestand, pdf, { contentType: "application/pdf" });
  return { pad, url: await getDownloadURL(bestand), op };
}
