import {
  type DoelSoort,
  type Minimumdoel,
  SOORT_KLEUR,
  SOORT_LABEL,
  alleMinimumdoelen,
} from "./minimumdoelen";
import type { Stroom } from "./types";

export { SOORT_KLEUR, SOORT_LABEL };
export type { DoelSoort };

/** Alle soorten in de volgorde waarin ze in een legende horen. */
export const DOEL_SOORTEN: DoelSoort[] = [
  "standaard",
  "uitbreiding",
  "freinet",
  "basisgeletterdheid",
];

/**
 * De doelcodes in het rubricsbestand staan iets losser genoteerd dan in de doelenlijst
 * ("UD 02.01" i.p.v. "UD02.01", "3.04" i.p.v. "03.04", "FR1" i.p.v. "F1"). Deze functie
 * brengt ze naar dezelfde vorm.
 */
function normaliseer(code: string): string {
  let c = code
    .replace(/\(.*?\)/g, "")
    .trim()
    .replace(/\s+/g, "");
  c = c.replace(/^FR/i, "F");
  const m = c.match(/^(\d+)(\..*)?$/);
  if (m) c = m[1].padStart(2, "0") + (m[2] ?? "");
  return c;
}

/**
 * Matcht een doelcode tegen een (deel)zoekterm zoals een mentor die intypt: "4", "16",
 * "16.01", "BG04", "UD02"… "4" en "04" gelden als hetzelfde. Leeg = altijd waar.
 */
export function codeMatchtPrefix(code: string, zoek: string): boolean {
  const q = zoek.trim().toLowerCase().replace(/\.+$/, "");
  if (!q) return true;
  const n = normaliseer(code).toLowerCase();
  const varianten = new Set([n]);
  const m = n.match(/^(\d+)/);
  if (m) varianten.add(String(Number(m[1])) + n.slice(m[1].length)); // "04.02" → "4.02"
  return [...varianten].some(
    (v) => v === q || v.startsWith(`${q}.`) || (q.includes(".") && v.startsWith(q)),
  );
}

/** De soort afleiden uit het codevoorvoegsel — als terugval wanneer het doel niet gevonden wordt. */
export function soortVanPrefix(code: string): DoelSoort {
  const c = code.trim().toUpperCase();
  if (c.startsWith("BG")) return "basisgeletterdheid";
  if (c.startsWith("UD") || /^U\d/.test(c)) return "uitbreiding";
  if (c.startsWith("F")) return "freinet";
  return "standaard";
}

export interface DoelTreffer {
  /** De code zoals ze in de rubric staat. */
  code: string;
  soort: DoelSoort;
  /** Het gekoppelde minimumdoel, als het gevonden is in de doelenlijst. */
  doel?: Minimumdoel;
}

/** Zoekt het minimumdoel bij een rubric-doelcode; valt terug op de stroom en dan op alle stromen. */
export function zoekDoel(code: string, stroom: Stroom): DoelTreffer {
  const norm = normaliseer(code);
  const kandidaten = [norm];
  if (/^U\d/.test(norm)) kandidaten.push(norm.slice(1)); // "U04.01.04" → "04.01.04"

  const vind = (s?: Stroom) =>
    alleMinimumdoelen.find(
      (d) => (!s || d.stroom === s) && kandidaten.includes(d.nummer),
    );

  const doel = vind(stroom) ?? vind();
  return { code, doel, soort: doel?.soort ?? soortVanPrefix(code) };
}
