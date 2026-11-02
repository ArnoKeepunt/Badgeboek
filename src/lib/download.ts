/** Bied een tekstbestand aan om te downloaden (met UTF-8 BOM voor Excel). */
export function downloadTekst(
  bestandsnaam: string,
  inhoud: string,
  mime = "text/csv;charset=utf-8",
) {
  downloadBlob(bestandsnaam, new Blob(["﻿", inhoud], { type: mime }));
}

/** Bied een bestand (pdf, zip, …) aan om te downloaden. */
export function downloadBlob(bestandsnaam: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = bestandsnaam;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Datumstempel voor bestandsnamen, bv. "2026-09-01". */
export const datumStempel = (): string => new Date().toISOString().slice(0, 10);
