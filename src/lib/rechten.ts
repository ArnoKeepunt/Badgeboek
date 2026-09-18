import { useMemo } from "react";
import { useBeheerderWeergave } from "./beheerderWeergave";
import { useHuidigPersoneelslid } from "./firebaseAuth";
import { useAangemeld, useBasisRol } from "./sessie";
import { useStore } from "./store";
import type { Student } from "./types";
import { actieveVestigingen } from "./vestigingen";

/**
 * Toegangsrechten tot leerlinggegevens — één plek.
 *
 * Vanwege de privacywetgeving mag een leerkracht niet zomaar álle leerlingen zien. De scope
 * (`Bereik`) komt van drie kanten:
 *  - de **"bekijk als"-kiezer** (`useAangemeld`): een beheerder test tijdelijk de weergave van
 *    een leerling (enkel zichzelf) of een mentor (diens vestiging);
 *  - het **echte personeelsaccount** (`useHuidigPersoneelslid`): een `mentor` is beperkt tot
 *    de eigen vestiging; `coordinator` en `beheerder` zien alles;
 *  - de **"beheerdersmodus uit"-schakelaar** (`useBeheerderWeergave`): een beheerder kan zichzelf
 *    tijdelijk tot zijn eigen vestiging(en) beperken, als was hij mentor. De schakelaar zelf is
 *    een client-side weergavevoorkeur (geen Firestore-schrijf, meteen aan/uit); de vestiging(en)
 *    zelf staan gewoon op het account (`Personeelslid.vestigingen`, in te stellen bij
 *    Gebruikers) — leeg = voorlopig alle vestigingen. De echte rechten (Firestore-rules)
 *    blijven ondertussen gewoon die van een beheerder.
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
  const basisRol = useBasisRol();
  const weergave = useBeheerderWeergave();
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
  if (basisRol === "beheerder" && weergave.vereenvoudigd) {
    // Nog geen vestiging(en) gekozen bij Gebruikers → voorlopig gewoon alles, i.p.v. niets.
    const eigen = persoon?.vestigingen.length ? persoon.vestigingen : actieveVestigingen().map((v) => v.naam);
    return { allesZichtbaar: false, vestigingen: eigen, eigenLeerlingId: null };
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
 * Stabiele id van wie er nu handelt, voor het "eigenaar"-veld op zelfgemaakte groepen (bepaalt
 * mee wie ze straks privé ziet, zie `Groep.prive`): het e-mailadres van een echt aangemeld
 * personeelslid — ongeacht rol, dus ook een beheerder — of de mentor-id bij "bekijk als mentor".
 * `undefined` enkel zonder echt account (local-modus, of een bootstrap-beheerder die zichzelf
 * nog niet aanmaakte) of bij "bekijk als leerling" — zo'n groep blijft voor iedereen zichtbaar.
 */
export function useHuidigeActorId(): string | undefined {
  const aangemeld = useAangemeld();
  const { persoon } = useHuidigPersoneelslid();
  if (aangemeld?.rol === "mentor") return aangemeld.mentor.id;
  if (persoon?.actief) return persoon.email;
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
