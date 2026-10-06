/**
 * Kleine CSV-hulp zonder externe afhankelijkheden.
 * - Lezen: standaard `,` of `;` als scheidingsteken (automatisch gedetecteerd op de kopregel;
 *   een import kan zelf de toegestane tekens kiezen), `"..."`-velden, dubbele `""` als
 *   ontsnapt aanhalingsteken, `\n` binnen een veld, optionele BOM.
 * - Schrijven: standaard `;` als scheidingsteken (Excel-NL-vriendelijk), CRLF-regeleindes.
 */

/**
 * Ruwe gok of dit eigenlijk geen platte tekst is — bv. een .xlsx (zip-archief, begint met de
 * bytes "PK") die per ongeluk als CSV gekozen werd, of hernoemd is zonder om te zetten. Geeft
 * een duidelijkere foutmelding dan "kolommen ontbreken".
 */
export const lijktOpBinairBestand = (text: string): boolean =>
  text.startsWith("PK") || text.slice(0, 2000).includes("\u0000");

/** De kopregel (eerste regel, zonder BOM) — bevat enkel kolomnamen, geen vrije tekst. */
export const kopregel = (text: string): string =>
  text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";

/**
 * Het scheidingsteken is het toegestane teken dat het vaakst in de kopregel voorkomt; bij
 * gelijkstand wint het eerste in `toegestaan`.
 */
export function parseCsv(text: string, toegestaan: string[] = [",", ";"]): string[][] {
  const s = text.replace(/^﻿/, "");
  const eerste = kopregel(s);
  const tel = (t: string) => eerste.split(t).length - 1;
  const delim = toegestaan.reduce((best, t) => (tel(t) > tel(best) ? t : best));

  const rijen: string[][] = [];
  let rij: string[] = [];
  let veld = "";
  let inQuotes = false;

  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          veld += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        veld += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      rij.push(veld);
      veld = "";
    } else if (c === "\n") {
      rij.push(veld);
      rijen.push(rij);
      rij = [];
      veld = "";
    } else if (c !== "\r") {
      veld += c;
    }
  }
  if (veld !== "" || rij.length > 0) {
    rij.push(veld);
    rijen.push(rij);
  }
  return rijen.filter((r) => r.some((v) => v.trim() !== ""));
}

export function toCsv(rijen: (string | number | null | undefined)[][], delim = ";"): string {
  const esc = (v: string | number | null | undefined): string => {
    const t = v == null ? "" : String(v);
    return /[",;|\t\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return rijen.map((r) => r.map(esc).join(delim)).join("\r\n");
}

/** Maak een lookup van kolomnaam (genormaliseerd) → index op basis van de kopregel. */
export function kopIndex(kop: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  kop.forEach((naam, i) => {
    map[naam.trim().toLowerCase()] = i;
  });
  return map;
}
