import { leerdoelenVoorStroom } from "./curriculum";
import { type KleurTelling, aantalBuitenBeschouwing, aantalIngevuld, telKleuren } from "./kleurstats";
import { isIngeschreven, stroomVan } from "./leerlingen";
import { getDoelKleur } from "./store";
import type { DoelKleuren, Rating, Student } from "./types";

export interface Voortgang {
  totaal: number;
  ingevuld: number;
  telling: KleurTelling;
}

/**
 * Hoeveel losse badges hebben al een kleur voor een set leerlingen, in een schooljaar.
 * Elke leerling telt mee met de badges van zijn/haar eigen stroom.
 */
export function voortgangVoor(
  leerlingen: Student[],
  kleuren: DoelKleuren,
  schooljaar: string,
): Voortgang {
  const waarden: (Rating | null)[] = [];
  for (const s of leerlingen) {
    if (!isIngeschreven(s, schooljaar)) continue;
    for (const d of leerdoelenVoorStroom(stroomVan(s, schooljaar))) {
      waarden.push(getDoelKleur(kleuren, schooljaar, s.id, d.id));
    }
  }
  const telling = telKleuren(waarden);
  // "n.v.t." / vrijgesteld / gewettigd afwezig vallen buiten de noemer.
  return {
    totaal: waarden.length - aantalBuitenBeschouwing(telling),
    ingevuld: aantalIngevuld(telling),
    telling,
  };
}
