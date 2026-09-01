/**
 * Binnen één schooljaar wordt per badge een kleur ingevuld **per rapportperiode**
 * (4 rapporten) én een **algemene** kleur (het overkoepelende oordeel — Keerpunt stelt dat
 * manueel op, er wordt niet gerekend). De algemene kleur blijft dus naast de periodes bestaan.
 */
export const PERIODES = [
  { id: "algemeen", kort: "Alg.", label: "Algemeen" },
  { id: "p1", kort: "R1", label: "Rapport 1" },
  { id: "p2", kort: "R2", label: "Rapport 2" },
  { id: "p3", kort: "R3", label: "Rapport 3" },
  { id: "p4", kort: "R4", label: "Rapport 4" },
] as const;

export type PeriodeId = (typeof PERIODES)[number]["id"];

export const ALGEMEEN: PeriodeId = "algemeen";

/** De rapportperiodes zonder "algemeen". */
export const RAPPORTPERIODES = PERIODES.filter((p) => p.id !== ALGEMEEN);

export const periodeLabel = (id: string): string =>
  PERIODES.find((p) => p.id === id)?.label ?? id;

export const isGeldigePeriode = (waarde: string): waarde is PeriodeId =>
  PERIODES.some((p) => p.id === waarde);
