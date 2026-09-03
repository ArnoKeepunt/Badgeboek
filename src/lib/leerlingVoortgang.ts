import { ALGEMEEN } from "./periode";
import { HUIDIG_SCHOOLJAAR } from "./schooljaar";
import { getDoelKleur, getNotitie } from "./store";
import type { DoelKleuren, Notities, Rating } from "./types";

/**
 * De kleur van een badge zoals de leerling ze ziet: de **algemene kleur van het lopende
 * schooljaar**. Dat is precies wat de mentor in het badgeboek heeft staan — haalt de mentor
 * de kleur weg, dan ziet de leerling ze ook niet meer. (Eerdere schooljaren blijven in de
 * leerlingdetailpagina zichtbaar, niet in dit overzicht.)
 */
export function graadKleur(
  kleuren: DoelKleuren,
  studentId: string,
  leerdoelId: string,
): Rating | null {
  return getDoelKleur(kleuren, HUIDIG_SCHOOLJAAR, ALGEMEEN, studentId, leerdoelId);
}

/** De zichtbare notitie bij een badge in het lopende schooljaar (voor de leerlingweergave). */
export function graadNotitie(
  notities: Notities,
  studentId: string,
  leerdoelId: string,
): string {
  return getNotitie(notities, HUIDIG_SCHOOLJAAR, studentId, leerdoelId).zichtbaar;
}
