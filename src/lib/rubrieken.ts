import type { Kleurcriteria, Rubriek, Stroom } from "./types";
import { rubrieken } from "./rubriekenData";

export { rubrieken };
export type { Rubriek };

/** De rubriekenlijst met de opgeslagen per-rubric-bewerkingen erover gelegd (op id). */
export function metRubriekWijzigingen(
  basis: Rubriek[],
  wijzigingen: Record<string, Partial<Rubriek>>,
): Rubriek[] {
  return basis.map((r) => {
    const patch = wijzigingen[r.id];
    return patch ? { ...r, ...patch, criteria: { ...r.criteria, ...patch.criteria } } : r;
  });
}

/** Rubrics beschrijven enkel de vier kleuren (geen witte statussen). Gedeeld tussen `Rubrics.tsx`
 * (naslag/bewerken) en het rapport (`RapportDetail.tsx`, kleur kiezen per rubric). */
export const KLEUREN = ["blue", "green", "yellow", "red"] as const;

/** Kleur → sleutel in `Kleurcriteria`. */
export const KLEUR_KEY: Record<(typeof KLEUREN)[number], keyof Kleurcriteria> = {
  red: "rood",
  yellow: "geel",
  green: "groen",
  blue: "blauw",
};

// Lowercase, spaties opgeruimd (dubbele spaties/tabs/rare witruimte → één spatie) — vangt de
// meeste "gewoon anders getypt"-verschillen tussen een badge-cursusnaam en een rubric-cursusnaam
// (die uit aparte bronbestanden komen, zie de rubrics-comment hieronder).
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Bewerkingsafstand (Levenshtein) tussen twee strings — voor de tikfout-vangnet hieronder. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const rij = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) rij[j] = j;
  for (let i = 1; i <= m; i++) {
    let vorigeDiag = rij[0];
    rij[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = rij[j];
      rij[j] = a[i - 1] === b[j - 1] ? vorigeDiag : 1 + Math.min(vorigeDiag, rij[j - 1], rij[j]);
      vorigeDiag = tmp;
    }
  }
  return rij[n];
}

/**
 * De rubrieken van één cursus (binnen een stroom), op volgorde. De cursusnaam in het
 * rubricsbestand (apart bronbestand, `docs/reference/rubrics_overzicht.xlsx`) is niet altijd
 * exact gelijk aan de badge-cursusnaam (ander bronbestand) — drie stappen, van strikt naar los:
 *
 * 1. Genormaliseerd gelijk, of het één een voorvoegsel van het ander (bv. "Actua" i.p.v.
 *    "Actuaronde", "Atelier" i.p.v. "Ateliers") — zelfde soort matching als
 *    `kapstokCursusVoorBadgeCursus` in `deelevaluaties.ts`.
 * 2. Vindt stap 1 niets: de rubric-cursusnaam in deze stroom met de kleinste tikfout-afstand
 *    (Levenshtein) tot de badge-cursusnaam (bv. "levvende wiksunde" i.p.v. "Levende Wiskunde") —
 *    enkel als die afstand klein genoeg is (verhoudingsgewijs tot de lengte) **en** ondubbelzinnig
 *    de beste match is, anders geen gok en dus geen koppeling.
 */
export function rubriekenVoorCursus(
  alle: Rubriek[],
  stroom: Stroom,
  cursusNaam: string,
): Rubriek[] {
  const inStroom = alle.filter((r) => r.stroom === stroom);
  const doel = norm(cursusNaam);

  const rechtstreeks = inStroom.filter((r) => {
    const n = norm(r.cursus);
    return n === doel || n.startsWith(doel) || doel.startsWith(n);
  });
  if (rechtstreeks.length > 0) return rechtstreeks.sort((a, b) => a.volgorde - b.volgorde);

  const kandidaten = [...new Set(inStroom.map((r) => r.cursus))];
  let besteNaam = "";
  let besteAfstand = Infinity;
  let tweedeBesteAfstand = Infinity;
  for (const naam of kandidaten) {
    const afstand = levenshtein(doel, norm(naam));
    if (afstand < besteAfstand) {
      tweedeBesteAfstand = besteAfstand;
      besteAfstand = afstand;
      besteNaam = naam;
    } else if (afstand < tweedeBesteAfstand) {
      tweedeBesteAfstand = afstand;
    }
  }
  const drempel = Math.max(2, Math.round(doel.length * 0.25));
  if (besteNaam && besteAfstand <= drempel && besteAfstand < tweedeBesteAfstand) {
    return inStroom
      .filter((r) => r.cursus === besteNaam)
      .sort((a, b) => a.volgorde - b.volgorde);
  }

  return [];
}
