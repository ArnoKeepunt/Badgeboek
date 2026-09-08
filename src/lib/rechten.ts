import { useMemo } from "react";
import { useHuidigPersoneelslid } from "./firebaseAuth";
import { useAangemeld } from "./sessie";
import { useStore } from "./store";
import type { Student } from "./types";

/**
 * Toegangsrechten tot leerlinggegevens — één plek.
 *
 * Vanwege de privacywetgeving mag een leerkracht niet zomaar álle leerlingen zien. De scope
 * (`Bereik`) komt van twee kanten:
 *  - de **"bekijk als"-kiezer** (`useAangemeld`): een beheerder test tijdelijk de weergave van
 *    een leerling (enkel zichzelf) of een mentor (diens vestiging);
 *  - het **echte personeelsaccount** (`useHuidigPersoneelslid`): een `mentor` is beperkt tot
 *    de eigen vestiging; `coordinator` en `beheerder` zien alles.
 *
 * Wordt de scope later fijnmaziger (per klasgroep, per groep), pas je enkel `useBereik` /
 * `magLeerlingZien` aan; de pagina's blijven ongewijzigd.
 */
export interface Bereik {
  /** `""` = alles zichtbaar; anders enkel deze vestiging. */
  vestiging: string;
  /** Gezet bij "bekijk als leerling" → enkel deze leerling. */
  eigenLeerlingId: string | null;
}

const ALLES: Bereik = { vestiging: "", eigenLeerlingId: null };

/** Het leerlingbereik van de huidige kijker. */
export function useBereik(): Bereik {
  const aangemeld = useAangemeld();
  const { persoon } = useHuidigPersoneelslid();
  if (aangemeld?.rol === "leerling") {
    return { vestiging: "", eigenLeerlingId: aangemeld.leerling.id };
  }
  if (aangemeld?.rol === "mentor") {
    return { vestiging: aangemeld.mentor.vestiging, eigenLeerlingId: null };
  }
  if (persoon?.actief && persoon.rol === "mentor") {
    return { vestiging: persoon.vestiging, eigenLeerlingId: null };
  }
  return ALLES;
}

/** Is het bereik ingeperkt tot één vestiging? */
export const bereikBeperkt = (b: Bereik): boolean => b.vestiging !== "";

/** Mag de huidige kijker (via `bereik`) de gegevens van deze leerling zien? */
export function magLeerlingZien(bereik: Bereik, leerling: Student): boolean {
  if (bereik.eigenLeerlingId) return leerling.id === bereik.eigenLeerlingId;
  return bereik.vestiging === "" || leerling.vestiging === bereik.vestiging;
}

export const leerlingenBinnenBereik = (bereik: Bereik, students: Student[]): Student[] =>
  students.filter((s) => magLeerlingZien(bereik, s));

/** Hook: de leerlingen die de huidige gebruiker mag zien (gebruik dit i.p.v. `store.students`). */
export function useZichtbareLeerlingen(): Student[] {
  const { students } = useStore();
  const bereik = useBereik();
  return useMemo(
    () => leerlingenBinnenBereik(bereik, students),
    // `bereik` wisselt van identiteit bij elke render; de twee primitieven vatten de inhoud samen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, bereik.vestiging, bereik.eigenLeerlingId],
  );
}
