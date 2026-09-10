/**
 * Kleine lijn-icoontjes voor rij-acties (bewerken / (de)activeren / verwijderen) in
 * overzichtslijsten — o.a. `/gebruikers` en `/vestigingen`. Gebruik met
 * `className="knop-icoon knop-icoon-klein knop-icoon--plat"` (+ `is-gevaar` voor verwijderen).
 */

const svgBasis = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const PotloodIcoon = () => (
  <svg {...svgBasis}>
    <path d="M10.5 2.5l3 3L6 13l-3.5.5L3 10z" />
  </svg>
);

/** Deactiveren — "uit de keuzelijsten halen". */
export const OogUitIcoon = () => (
  <svg {...svgBasis}>
    <path d="M2 8s2.4-4.3 6-4.3S14 8 14 8s-2.4 4.3-6 4.3S2 8 2 8z" />
    <circle cx="8" cy="8" r="1.7" />
    <path d="M2.5 2.5l11 11" />
  </svg>
);

/** Heractiveren. */
export const OogIcoon = () => (
  <svg {...svgBasis}>
    <path d="M2 8s2.4-4.3 6-4.3S14 8 14 8s-2.4 4.3-6 4.3S2 8 2 8z" />
    <circle cx="8" cy="8" r="1.7" />
  </svg>
);

export const PrullenbakIcoon = () => (
  <svg {...svgBasis}>
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.6 4.5l.5 8.1a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.5-8.1M6.8 6.8v4.4M9.2 6.8v4.4" />
  </svg>
);
