import { useEffect, useState } from "react";
import { HUIDIG_SCHOOLJAAR, schooljaarAfstand } from "./schooljaar";
import type { Stroom, Student } from "./types";

/** 1-2 → 1e graad, 3-4 → 2e graad, 5-6 → 3e graad. */
export const graadVan = (leerjaar: number): number => Math.ceil(leerjaar / 2);

/**
 * Het leerjaar van een leerling in een bepaald schooljaar. Eerst uit `leerjaarHistoriek`;
 * ontbreekt dat jaar, dan lineair teruggerekend vanaf het huidige `leerjaar` (elke schooljaar
 * terug = één leerjaar minder). Kan < 1 zijn → de leerling zat er toen (nog) niet.
 */
export function leerjaarInSchooljaar(s: Student, schooljaar: string): number {
  const uitHistoriek = s.leerjaarHistoriek?.[schooljaar];
  if (typeof uitHistoriek === "number") return uitHistoriek;
  const stap = schooljaarAfstand(schooljaar, HUIDIG_SCHOOLJAAR);
  return stap === null ? s.leerjaar : s.leerjaar - stap;
}

/** Zat deze leerling in dat schooljaar al op school (leerjaar ≥ 1)? */
export const isIngeschreven = (s: Student, schooljaar: string): boolean =>
  leerjaarInSchooljaar(s, schooljaar) >= 1;

/**
 * De stroom (badgeboek) van een leerling. In de 1e graad bestaat A én B; vanaf de 2e graad
 * werken we (voorlopig) enkel met de A-stroom. Geef `schooljaar` mee om de stroom van *toen*
 * te krijgen (voor het bekijken van een vorig schooljaar / een vorige graad).
 */
export const stroomVan = (s: Student, schooljaar?: string): Stroom => {
  const lj = schooljaar ? leerjaarInSchooljaar(s, schooljaar) : s.leerjaar;
  const g = graadVan(Math.min(6, Math.max(1, lj)));
  if (g === 1) return s.klasgroep === "B" ? "1B" : "1A";
  if (g === 2) return "2A";
  return "3A";
};

export const GRAAD_LABEL: Record<number, string> = {
  1: "1e graad",
  2: "2e graad",
  3: "3e graad",
};

export interface LeerlingFilter {
  zoek: string;
  vestiging: string;
  graad: string;
  leerjaar: string;
  klasgroep: string;
  /** Id van een geselecteerde groep (eigen of systeem), of "" voor geen groep. */
  groepId: string;
}

export const LEEG_FILTER: LeerlingFilter = {
  zoek: "",
  vestiging: "",
  graad: "",
  leerjaar: "",
  klasgroep: "",
  groepId: "",
};

export const filterActief = (f: LeerlingFilter): boolean =>
  Boolean(f.zoek || f.vestiging || f.graad || f.leerjaar || f.klasgroep || f.groepId);

/**
 * Pas een filter toe op een lijst leerlingen. Lege velden = "alle".
 * `groepLeden` (optioneel) beperkt vooraf tot de leden van een gekozen groep.
 */
export function filterLeerlingen(
  students: Student[],
  f: LeerlingFilter,
  groepLeden?: Set<string> | null,
): Student[] {
  const zoek = f.zoek.trim().toLowerCase();
  return students.filter((s) => {
    if (groepLeden && !groepLeden.has(s.id)) return false;
    if (f.vestiging && s.vestiging !== f.vestiging) return false;
    if (f.graad && String(graadVan(s.leerjaar)) !== f.graad) return false;
    if (f.leerjaar && String(s.leerjaar) !== f.leerjaar) return false;
    if (f.klasgroep && s.klasgroep !== f.klasgroep) return false;
    if (zoek && !`${s.firstName} ${s.lastName}`.toLowerCase().includes(zoek)) return false;
    return true;
  });
}

/** Unieke, gesorteerde waarden voor een keuzelijst. */
export const unieke = <T extends string | number>(waarden: T[]): T[] =>
  [...new Set(waarden)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

// --- Gedeelde, lokaal bewaarde filterstand -----------------------------------

const FILTER_KEY = "keerpunt-badgeboek:leerling-filter";

/** Graad en leerjaar consistent houden: bij een tegenstrijdige combinatie wint het leerjaar. */
export function verzoenGraadLeerjaar(f: LeerlingFilter): LeerlingFilter {
  if (f.leerjaar) {
    const g = String(graadVan(Number(f.leerjaar)));
    return f.graad === g ? f : { ...f, graad: g };
  }
  return f;
}

function loadFilter(): LeerlingFilter {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (raw) {
      return verzoenGraadLeerjaar({
        ...LEEG_FILTER,
        ...(JSON.parse(raw) as Partial<LeerlingFilter>),
      });
    }
  } catch {
    // geen opgeslagen filter
  }
  return LEEG_FILTER;
}

/**
 * Eén filterstand die door alle pagina's gedeeld wordt en lokaal bewaard blijft, zodat een
 * mentor zijn/haar groep maar één keer hoeft in te stellen.
 */
export function useLeerlingFilter(): [LeerlingFilter, (next: LeerlingFilter) => void] {
  const [filter, setFilter] = useState<LeerlingFilter>(loadFilter);

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(filter));
    } catch {
      // opslag niet beschikbaar
    }
  }, [filter]);

  return [filter, setFilter];
}
