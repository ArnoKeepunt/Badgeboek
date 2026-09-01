import { useEffect, useState } from "react";
import type { Student } from "./types";

/** 1-2 → 1e graad, 3-4 → 2e graad, 5-6 → 3e graad. */
export const graadVan = (leerjaar: number): number => Math.ceil(leerjaar / 2);

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

function loadFilter(): LeerlingFilter {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (raw) return { ...LEEG_FILTER, ...(JSON.parse(raw) as Partial<LeerlingFilter>) };
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
