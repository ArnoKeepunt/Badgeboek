import { meldAfVanFirebase } from "./data";
import { bewaarAlles } from "./opslagStatus";

/**
 * Afmelden zonder werk te verliezen: eerst alles bewaren wat nog openstaat. Lukt dat niet (bv.
 * geen verbinding), dan vragen we eerst of je toch wil afmelden. De onbewaarde wijzigingen
 * blijven als back-up in de browser (`data/onbewaardBackup.ts`) en vertrekken bij de volgende
 * login van hetzelfde account. Geeft `true` als er effectief afgemeld werd.
 */
export async function meldAfMetBewaren(): Promise<boolean> {
  if (!(await bewaarAlles())) {
    const toch = window.confirm(
      "Niet al je wijzigingen zijn al in de database bewaard (geen verbinding?). " +
        "Ze blijven in deze browser staan en worden verstuurd zodra je hier opnieuw " +
        "aanmeldt met hetzelfde account.\n\nToch afmelden?",
    );
    if (!toch) return false;
  }
  await meldAfVanFirebase();
  return true;
}
