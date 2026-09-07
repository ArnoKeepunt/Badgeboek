import { useMemo } from "react";
import { type Aangemeld, useAangemeld } from "./sessie";
import { useStore } from "./store";
import type { Student } from "./types";

/**
 * Toegangsrechten tot leerlinggegevens.
 *
 * Vanwege de privacywetgeving mag een leerkracht niet zomaar álle leerlingen zien: voorlopig
 * beperken we het tot de leerlingen van de eigen vestiging. Een beheerder (of niemand
 * aangemeld = beheerdersmodus) ziet iedereen. Een leerling ziet enkel zichzelf.
 *
 * Dit is bewust één plek. Wanneer de rechten later fijnmaziger worden (per klasgroep, per
 * groep, per individuele leerling — aangestuurd vanuit de database), pas je enkel
 * `leerlingenBinnenBereik` / `magLeerlingZien` aan; de pagina's blijven ongewijzigd.
 */

/** De vestiging waartoe een leerkracht beperkt is, of `""` als de gebruiker alles mag zien. */
export function bereikVestiging(aangemeld: Aangemeld): string {
  return aangemeld?.rol === "mentor" ? aangemeld.mentor.vestiging : "";
}

/** Is het leerlingbereik ingeperkt (een mentor met een vestiging-scope)? */
export function bereikBeperkt(aangemeld: Aangemeld): boolean {
  return bereikVestiging(aangemeld) !== "";
}

/** Mag de aangemelde gebruiker de gegevens van deze leerling zien? */
export function magLeerlingZien(aangemeld: Aangemeld, leerling: Student): boolean {
  if (aangemeld?.rol === "leerling") return leerling.id === aangemeld.leerling.id;
  const vestiging = bereikVestiging(aangemeld);
  return vestiging === "" || leerling.vestiging === vestiging;
}

/** De leerlingen binnen het bereik van de aangemelde gebruiker. */
export function leerlingenBinnenBereik(aangemeld: Aangemeld, students: Student[]): Student[] {
  return students.filter((s) => magLeerlingZien(aangemeld, s));
}

/** Hook: de leerlingen die de huidige gebruiker mag zien (gebruik dit i.p.v. `store.students`). */
export function useZichtbareLeerlingen(): Student[] {
  const { students } = useStore();
  const aangemeld = useAangemeld();
  // Stabiele sleutel voor de memo: de scope verandert enkel bij aan-/afmelden.
  const scope =
    aangemeld?.rol === "leerling"
      ? `leerling:${aangemeld.leerling.id}`
      : `vestiging:${bereikVestiging(aangemeld)}`;
  return useMemo(
    () => leerlingenBinnenBereik(aangemeld, students),
    // aangemeld wisselt van identiteit bij elke render; `scope` vat de relevante inhoud samen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, scope],
  );
}
