import { HUIDIG_SCHOOLJAAR } from "./schooljaar";
import { getDoelKleur, getNotitie } from "./store";
import type { DoelKleuren, Notities, Rating } from "./types";

/**
 * De kleur van een badge zoals de leerling ze ziet in het **lopende schooljaar** — inclusief
 * de kleuren die overgenomen zijn uit vorig schooljaar binnen dezelfde graad (`getDoelKleur`
 * doet die overname). Haalt de mentor een kleur bewust weg, dan ziet de leerling ze niet meer.
 */
export function graadKleur(
  kleuren: DoelKleuren,
  studentId: string,
  leerdoelId: string,
): Rating | null {
  return getDoelKleur(kleuren, HUIDIG_SCHOOLJAAR, studentId, leerdoelId);
}

/** De zichtbare notitie bij een badge in het lopende schooljaar (voor de leerlingweergave). */
export function graadNotitie(
  notities: Notities,
  studentId: string,
  leerdoelId: string,
): string {
  return getNotitie(notities, HUIDIG_SCHOOLJAAR, studentId, leerdoelId).zichtbaar;
}
