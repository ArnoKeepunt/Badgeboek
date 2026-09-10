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
  /** `true` = alle vestigingen zichtbaar (coördinator/beheerder). */
  allesZichtbaar: boolean;
  /**
   * Als `!allesZichtbaar`: de vestigingen die de kijker mag zien. Een mentor kan aan meerdere
   * campussen lesgeven, dus dit is een lijst. Leeg = ziet niets (mentor zonder vestiging).
   */
  vestigingen: string[];
  /** Gezet bij "bekijk als leerling" → enkel deze leerling. */
  eigenLeerlingId: string | null;
}

const ALLES: Bereik = { allesZichtbaar: true, vestigingen: [], eigenLeerlingId: null };

/** Het leerlingbereik van de huidige kijker. */
export function useBereik(): Bereik {
  const aangemeld = useAangemeld();
  const { persoon } = useHuidigPersoneelslid();
  if (aangemeld?.rol === "leerling") {
    return { allesZichtbaar: false, vestigingen: [], eigenLeerlingId: aangemeld.leerling.id };
  }
  if (aangemeld?.rol === "mentor") {
    const v = aangemeld.mentor.vestiging;
    return { allesZichtbaar: false, vestigingen: v ? [v] : [], eigenLeerlingId: null };
  }
  if (persoon?.actief && persoon.rol === "mentor") {
    return { allesZichtbaar: false, vestigingen: persoon.vestigingen, eigenLeerlingId: null };
  }
  return ALLES;
}

/** Is het bereik ingeperkt (mentor/leerling), of ziet de kijker alles? */
export const bereikBeperkt = (b: Bereik): boolean => !b.allesZichtbaar;

/**
 * De ene vaste vestiging van de kijker, of `""` als hij er geen of meerdere heeft (dan kiest
 * hij zelf via het vestigingfilter). Voor plekken die met één waarde werken (deelbadge-matrix).
 */
export const bereikVestiging = (b: Bereik): string =>
  !b.allesZichtbaar && b.vestigingen.length === 1 ? b.vestigingen[0] : "";

/**
 * Stabiele id van wie er nu handelt, voor het "eigenaar"-veld op zelfgemaakte groepen: het
 * e-mailadres van een echt aangemeld personeelslid, of de mentor-id bij "bekijk als mentor".
 * `undefined` voor een beheerder/coördinator-overzicht — die zien alle groepen.
 */
export function useHuidigeActorId(): string | undefined {
  const aangemeld = useAangemeld();
  const { persoon } = useHuidigPersoneelslid();
  if (aangemeld?.rol === "mentor") return aangemeld.mentor.id;
  if (persoon?.actief && (persoon.rol === "mentor" || persoon.rol === "coordinator")) {
    return persoon.email;
  }
  return undefined;
}

/** Mag de huidige kijker (via `bereik`) de gegevens van deze leerling zien? */
export function magLeerlingZien(bereik: Bereik, leerling: Student): boolean {
  if (bereik.eigenLeerlingId) return leerling.id === bereik.eigenLeerlingId;
  if (bereik.allesZichtbaar) return true;
  return bereik.vestigingen.includes(leerling.vestiging);
}

export const leerlingenBinnenBereik = (bereik: Bereik, students: Student[]): Student[] =>
  students.filter((s) => magLeerlingZien(bereik, s));

/** Hook: de leerlingen die de huidige gebruiker mag zien (gebruik dit i.p.v. `store.students`). */
export function useZichtbareLeerlingen(): Student[] {
  const { students } = useStore();
  const bereik = useBereik();
  return useMemo(
    () => leerlingenBinnenBereik(bereik, students),
    // `bereik` wisselt van identiteit bij elke render; de primitieven vatten de inhoud samen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, bereik.allesZichtbaar, bereik.vestigingen.join(","), bereik.eigenLeerlingId],
  );
}
