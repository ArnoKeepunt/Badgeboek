/**
 * Kleine CSV-hulp zonder externe afhankelijkheden.
 * - Lezen: `,` of `;` als scheidingsteken (automatisch gedetecteerd), `"..."`-velden,
 *   dubbele `""` als ontsnapt aanhalingsteken, `\n` binnen een veld, optionele BOM.
 * - Schrijven: `;` als scheidingsteken (Excel-NL-vriendelijk), CRLF-regeleindes.
 */

export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, "");
  const eerste = s.split(/\r?\n/, 1)[0] ?? "";
  const komma = (eerste.match(/,/g) ?? []).length;
  const puntkomma = (eerste.match(/;/g) ?? []).length;
  const delim = puntkomma > komma ? ";" : ",";

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

export function toCsv(rijen: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined): string => {
    const t = v == null ? "" : String(v);
    return /[",;\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return rijen.map((r) => r.map(esc).join(";")).join("\r\n");
}

/** Maak een lookup van kolomnaam (genormaliseerd) → index op basis van de kopregel. */
export function kopIndex(kop: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  kop.forEach((naam, i) => {
    map[naam.trim().toLowerCase()] = i;
  });
  return map;
}
