/**
 * Schooljaren, genoteerd als "2026-2027". Keerpunt evalueert per graad, maar wil ook per
 * schooljaar kunnen werken en archiveren — voorbije schooljaren blijven raadpleegbaar.
 * Voorlopig een vaste lijst; later uit te breiden / af te leiden.
 */
export const SCHOOLJAREN = ["2024-2025", "2025-2026", "2026-2027"] as const;

export type Schooljaar = (typeof SCHOOLJAREN)[number];

/** Het lopende schooljaar. */
export const HUIDIG_SCHOOLJAAR: Schooljaar = "2026-2027";

/**
 * Afgesloten schooljaren: hun evaluaties zijn alleen-lezen ("vastgezet in september"). De
 * beheerder sluit/heropent een schooljaar op /gegevens; dat wordt in de store bewaard
 * (`afgeslotenSchooljaren`). Deze lijst is de standaard als er (nog) niets bewaard is.
 */
export const AFGESLOTEN_SCHOOLJAREN: readonly Schooljaar[] = ["2024-2025"];

let _afgesloten: ReadonlySet<string> = new Set(AFGESLOTEN_SCHOOLJAREN);

/** Zet de afgesloten schooljaren (door de store, uit de opslag). `null`/`undefined` = standaard. */
export function zetAfgeslotenSchooljaren(lijst: readonly string[] | null | undefined): void {
  _afgesloten = new Set(lijst ?? AFGESLOTEN_SCHOOLJAREN);
}

export const isAfgesloten = (schooljaar: string): boolean => _afgesloten.has(schooljaar);

/** De actueel afgesloten schooljaren, in chronologische volgorde. */
export const afgeslotenSchooljaren = (): string[] =>
  (SCHOOLJAREN as readonly string[]).filter((s) => _afgesloten.has(s));

export const isGeldigSchooljaar = (waarde: string): waarde is Schooljaar =>
  (SCHOOLJAREN as readonly string[]).includes(waarde);

/**
 * De schooljaren vóór `schooljaar`, meest recente eerst. Gebruikt voor de overname van
 * badge-kleuren binnen dezelfde graad (een leerling in het 2e jaar van zijn graad begint
 * met de stand van vorig schooljaar).
 */
export const eerdereSchooljaren = (schooljaar: string): string[] => {
  const i = (SCHOOLJAREN as readonly string[]).indexOf(schooljaar);
  return i <= 0 ? [] : SCHOOLJAREN.slice(0, i).reverse();
};

/**
 * Aantal schooljaren tussen `van` en `naar` (positief = `naar` ligt later). `null` als een van
 * beide niet in `SCHOOLJAREN` staat.
 */
export const schooljaarAfstand = (van: string, naar: string): number | null => {
  const a = (SCHOOLJAREN as readonly string[]).indexOf(van);
  const b = (SCHOOLJAREN as readonly string[]).indexOf(naar);
  return a === -1 || b === -1 ? null : b - a;
};
