import { PERSISTENTIE_MODUS } from "./data";
import { uploadRapportPdf } from "./data/rapportPdfOpslag";
import { maakRapportPdf } from "./rapportPdf";
import { voegRapportPdfToe } from "./store";
import type { Rapport, Rubriek, Student } from "./types";

/** Kan de app pdf's in de database bewaren? Enkel met Firebase (local-modus: geen Storage). */
export const PDF_ARCHIEF_ACTIEF = PERSISTENTIE_MODUS === "firebase";

/**
 * Maak de pdf van een (net) afgewerkt rapport en bewaar ze als nieuwe versie in de database
 * (Firebase Storage + een verwijzing op het rapport). Gooit bij een fout — de aanroeper toont dat;
 * het rapport zelf blijft gewoon afgewerkt, en "Pdf bewaren" kan het later opnieuw proberen.
 */
export async function archiveerRapportPdf(
  student: Student,
  rapport: Rapport,
  rubrieken: Rubriek[],
): Promise<void> {
  if (!PDF_ARCHIEF_ACTIEF) return;
  const pdf = await maakRapportPdf(student, rapport, rubrieken);
  voegRapportPdfToe(rapport.id, await uploadRapportPdf(rapport.id, pdf));
}
