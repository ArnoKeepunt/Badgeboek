import { meldAfVanFirebase } from "./data";
import { bewaarAlles } from "./opslagStatus";

/**
 * Afmelden zonder werk te verliezen: eerst alles bewaren wat nog openstaat. Lukt dat niet (bv.
 * geen verbinding), dan vragen we eerst of je toch wil afmelden — je onbewaarde wijzigingen
 * gaan dan verloren. Geeft `true` als er effectief afgemeld werd.
 */
export async function meldAfMetBewaren(): Promise<boolean> {
  if (!(await bewaarAlles())) {
    const toch = window.confirm(
      "Niet al je wijzigingen zijn al in de database bewaard (geen verbinding?). " +
        "Als je nu afmeldt, gaan ze verloren.\n\nToch afmelden?",
    );
    if (!toch) return false;
  }
  await meldAfVanFirebase();
  return true;
}
