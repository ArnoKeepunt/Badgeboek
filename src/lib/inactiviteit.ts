/** Na zoveel minuten zonder activiteit word je afgemeld. */
export const INACTIEF_MS = 30 * 60 * 1000;
/**
 * Hoe lang de "Ben je er nog?"-aftelling duurt. Ze verschijnt dus na
 * `INACTIEF_MS - WAARSCHUWING_MS` zonder activiteit.
 */
export const WAARSCHUWING_MS = 2 * 60 * 1000;

/** Gedeeld over alle tabbladen: activiteit in één tab houdt de andere ook aangemeld. */
export const ACTIVITEIT_SLEUTEL = "badgeboek.laatsteActiviteit";

export function leesLaatsteActiviteit(): number | null {
  try {
    const waarde = Number(localStorage.getItem(ACTIVITEIT_SLEUTEL));
    return Number.isFinite(waarde) && waarde > 0 ? waarde : null;
  } catch {
    return null;
  }
}

export function schrijfLaatsteActiviteit(tijd: number) {
  try {
    localStorage.setItem(ACTIVITEIT_SLEUTEL, String(tijd));
  } catch {
    // Privévenster / geblokkeerde opslag: dan telt enkel dit tabblad.
  }
}

/** Gezet net vóór een automatische afmelding, zodat het inlogscherm kan zeggen waarom. */
let wegensInactiviteit = false;
export const zetAfgemeldWegensInactiviteit = (waarde: boolean) => {
  wegensInactiviteit = waarde;
};
export const isAfgemeldWegensInactiviteit = () => wegensInactiviteit;
