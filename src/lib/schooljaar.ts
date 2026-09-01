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
 * Afgesloten schooljaren staan vast: hun evaluaties zijn alleen-lezen. Voorlopig een vaste
 * lijst — er is nog geen knop om een schooljaar af te sluiten of te heropenen. Dat wordt
 * later een beheerdersrecht (zie evaluatiebeleid: "resultaten na het schooljaar vastzetten").
 */
export const AFGESLOTEN_SCHOOLJAREN: readonly Schooljaar[] = ["2024-2025"];

export const isAfgesloten = (schooljaar: string): boolean =>
  (AFGESLOTEN_SCHOOLJAREN as readonly string[]).includes(schooljaar);

export const isGeldigSchooljaar = (waarde: string): waarde is Schooljaar =>
  (SCHOOLJAREN as readonly string[]).includes(waarde);
