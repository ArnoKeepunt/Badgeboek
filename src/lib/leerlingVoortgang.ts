import { ALGEMEEN } from "./periode";
import { SCHOOLJAREN } from "./schooljaar";
import { getDoelKleur, getNotitie } from "./store";
import type { DoelKleuren, Notities, Rating } from "./types";

/**
 * De "graadskleur" van een badge voor een leerling: de **meest recente** algemene kleur.
 * Een leerling zit meerdere jaren in een graad; we nemen het laatste schooljaar waarin de
 * mentor een algemene kleur zette. Dat weerspiegelt waar de leerling nú staat (de evolutie
 * zit al in dat oordeel) — niet de beste kleur ooit, en geen gemiddelde.
 */
export function graadKleur(
  kleuren: DoelKleuren,
  studentId: string,
  leerdoelId: string,
): Rating | null {
  for (let i = SCHOOLJAREN.length - 1; i >= 0; i -= 1) {
    const k = getDoelKleur(kleuren, SCHOOLJAREN[i], ALGEMEEN, studentId, leerdoelId);
    if (k) return k;
  }
  return null;
}

/** De meest recente zichtbare notitie bij een badge (voor de leerlingweergave). */
export function graadNotitie(
  notities: Notities,
  studentId: string,
  leerdoelId: string,
): string {
  for (let i = SCHOOLJAREN.length - 1; i >= 0; i -= 1) {
    const n = getNotitie(notities, SCHOOLJAREN[i], studentId, leerdoelId);
    if (n.zichtbaar) return n.zichtbaar;
  }
  return "";
}
