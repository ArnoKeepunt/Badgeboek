import { leerdoelenVoorStroom } from "./curriculum";
import { type KleurTelling, telKleuren } from "./kleurstats";
import { stroomVan } from "./leerlingen";
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
    for (const d of leerdoelenVoorStroom(stroomVan(s))) {
      waarden.push(getDoelKleur(kleuren, schooljaar, s.id, d.id));
    }
  }
  const telling = telKleuren(waarden);
  return { totaal: waarden.length, ingevuld: waarden.length - telling.leeg, telling };
}
