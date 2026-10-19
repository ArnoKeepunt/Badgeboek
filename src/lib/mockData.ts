import { seedMentoren } from "./seedGebruikers";
import type { Mentor } from "./types";

/**
 * Seed-data. Enkel nog de fictieve mentor-accounts voor de demo-login (/aanmelden). Er zitten
 * bewust géén leerlingen, evaluaties, voorbeeld-deelbadges of meldingen meer in: de échte
 * leerlingen komen uit de CSV-import op /gegevens (Smartschool-export), en wat er nog aan oude
 * demodata in de opslag staat, ruimt "Fictieve leerlingen opruimen" op diezelfde pagina op.
 */
export const mentoren: Mentor[] = seedMentoren;
