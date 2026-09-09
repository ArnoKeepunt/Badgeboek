/**
 * Eén set lijn-icoontjes (24×24, currentColor) voor de navigatie en de overzichtskaarten.
 * Zelfde stijl overal: `stroke-width` 1.8, ronde hoeken.
 */

import type { ReactNode } from "react";

export type IcoonNaam =
  | "overzicht"
  | "badges"
  | "deelevaluaties"
  | "rubrics"
  | "doelen"
  | "groepen"
  | "leerlingen"
  | "gebruikers"
  | "vestigingen"
  | "gegevens";

const basis = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const paden: Record<IcoonNaam, ReactNode> = {
  // Overzicht — een dashboard-indeling.
  overzicht: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="3" y="15" width="7" height="6" rx="1.5" />
      <rect x="14" y="3" width="7" height="6" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
    </>
  ),
  // Badges — een rozet/medaille.
  badges: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5" />
    </>
  ),
  // Deelevaluaties — een afgevinkte checklist.
  deelevaluaties: (
    <>
      <path d="M9 5h9M9 12h9M9 19h9" />
      <path d="m3 4.5 1.5 1.5L7 3.5M3 11.5 4.5 13 7 10.5M3 18.5 4.5 20 7 17.5" />
    </>
  ),
  // Rubrics — een raster van criteria per kleur.
  rubrics: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </>
  ),
  // Doelen — een schietschijf.
  doelen: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // Groepen — meerdere personen.
  groepen: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 13.5a5.5 5.5 0 0 1 3 5" />
    </>
  ),
  // Leerlingen — één persoon.
  leerlingen: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  // Gebruikers — twee personen (accountbeheer).
  gebruikers: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8M17.5 19a5.5 5.5 0 0 0-3-4.9" />
    </>
  ),
  // Vestigingen — een gebouw/campus.
  vestigingen: (
    <>
      <path d="M4 21V6l7-3 7 3v15" />
      <path d="M3 21h18" />
      <path d="M9 21v-4h4v4M8 9h1M8 12.5h1M14 9h1M14 12.5h1" />
    </>
  ),
  // Gegevens — import/export (pijlen naar een bak).
  gegevens: (
    <>
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
      <path d="M12 4v10M8.5 10.5 12 14l3.5-3.5" />
    </>
  ),
};

export function Icoon({ naam, className }: { naam: IcoonNaam; className?: string }) {
  return (
    <svg width={18} height={18} className={className} {...basis}>
      {paden[naam]}
    </svg>
  );
}
