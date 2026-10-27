/** Na zoveel minuten zonder activiteit word je afgemeld. */
export const INACTIEF_MS = 30 * 60 * 1000;
/**
 * Hoe lang de "Ben je er nog?"-aftelling duurt. Ze verschijnt dus na
 * `INACTIEF_MS - WAARSCHUWING_MS` zonder activiteit.
 */
export const WAARSCHUWING_MS = 2 * 60 * 1000;

/**
 * Maximale sessieduur, ook bij voortdurende activiteit: zoveel na de laatste echte Google-login
 * weigert de database alles (`sessieGeldig()` in `firestore.rules` — hou beide gelijk). De app
 * vraagt vooraf om de login te bevestigen, zodat er geen werk verloren gaat.
 */
export const MAX_SESSIE_MS = 12 * 60 * 60 * 1000;
/** Zoveel vóór het einde van de sessie verschijnt de vraag om opnieuw te bevestigen. */
export const SESSIE_WAARSCHUWING_MS = 5 * 60 * 1000;

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

/** Waarom de app je automatisch afmeldde: te lang niet actief, of de sessie liep af. */
export type AfmeldReden = "inactief" | "sessie";

/** Gezet net vóór een automatische afmelding, zodat het inlogscherm kan zeggen waarom. */
let afmeldReden: AfmeldReden | null = null;
export const zetAfmeldReden = (reden: AfmeldReden | null) => {
  afmeldReden = reden;
};
export const leesAfmeldReden = () => afmeldReden;
