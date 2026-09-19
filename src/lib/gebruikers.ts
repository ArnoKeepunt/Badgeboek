/**
 * De personeelsrollen. `mentor` en `extern` zijn vestiging-gebonden; `coordinator` en
 * `beheerder` niet. `extern` ("externe mentor") heeft exact dezelfde rechten als `mentor` —
 * overal waar de rechten/het gedrag bepaald wordt, tellen ze als hetzelfde (zie
 * `isMentorachtigeRol`); het is enkel een apart label/rol om ze in de lijst te kunnen
 * onderscheiden (bv. niet in loondienst).
 */
export type PersoneelRol = "beheerder" | "coordinator" | "mentor" | "extern";

export const PERSONEEL_ROLLEN: PersoneelRol[] = ["mentor", "extern", "coordinator", "beheerder"];

export const PERSONEEL_ROL_LABEL: Record<PersoneelRol, string> = {
  beheerder: "Beheerder",
  coordinator: "Coördinator",
  mentor: "Mentor",
  extern: "Externe mentor",
};

export const PERSONEEL_ROL_UITLEG: Record<PersoneelRol, string> = {
  beheerder: "Volledige toegang, inclusief accountbeheer en de gegevens-/badgesinstellingen.",
  coordinator: "Alle vestigingen zien en evalueren, maar geen accountbeheer of instellingen.",
  mentor: "Enkel de leerlingen van de aangevinkte vestiging(en).",
  extern:
    "Exact dezelfde rechten als een mentor — enkel de leerlingen van de aangevinkte " +
    "vestiging(en). Louter een apart label voor externe mentoren (bv. niet in loondienst).",
};

/** Gedraagt deze rol zich als mentor (vestiging-gebonden bereik, geen beheerderstoegang)? */
export const isMentorachtigeRol = (rol: PersoneelRol): boolean =>
  rol === "mentor" || rol === "extern";

/** Eén personeelsaccount uit Firestore (`gebruikers/{email}`). Nooit een wachtwoord. */
export interface Personeelslid {
  email: string;
  naam: string;
  rol: PersoneelRol;
  /**
   * De vestigingen waar dit personeelslid toegang toe heeft (iemand kan aan meerdere campussen
   * lesgeven).
   * - Bij `rol: "mentor"` bepaalt dit meteen het echte leerlingenbereik; leeg = (nog) geen
   *   enkele vestiging → ziet niets. `coordinator` ziet sowieso alles, ongeacht dit veld.
   * - Bij `rol: "beheerder"` heeft dit geen invloed op de echte rechten (die zien sowieso
   *   alles) — het is enkel de vestiging-selectie voor als de beheerder zelf de
   *   "vereenvoudigde weergave" aanzet (zie `useBereik`). Leeg = voorlopig alle vestigingen.
   */
  vestigingen: string[];
  actief: boolean;
  /**
   * Extra toegang tot de nog-in-ontwikkeling pagina's (Deelbadges, Rubrics). Alleen een
   * bootstrap-beheerder kan dit zetten. `undefined`/`false` = geen dev-toegang.
   */
  dev?: boolean;
}

/**
 * Een `gebruikers/{email}`-document → `Personeelslid`. Vangt oudere documenten op die nog één
 * `vestiging`-string hadden i.p.v. de `vestigingen`-lijst.
 */
export function normaliseerGebruiker(d: Record<string, unknown>): Personeelslid {
  const vestigingen = Array.isArray(d.vestigingen)
    ? (d.vestigingen as unknown[]).filter((v): v is string => typeof v === "string")
    : typeof d.vestiging === "string" && d.vestiging
      ? [d.vestiging]
      : [];
  return {
    email: typeof d.email === "string" ? d.email : "",
    naam: typeof d.naam === "string" ? d.naam : "",
    rol: (d.rol as PersoneelRol) ?? "mentor",
    vestigingen,
    actief: d.actief === true,
    dev: d.dev === true,
  };
}

/** Deze mail kan altijd binnen (spiegelt `isBootstrapAdmin()` in firestore.rules). */
export const BOOTSTRAP_ADMIN = "arno.boriau@keerpuntscholen.be";

export const isBootstrapAdmin = (email: string | null | undefined): boolean =>
  (email ?? "").toLowerCase() === BOOTSTRAP_ADMIN;

/** Mag deze persoon de in-ontwikkeling-pagina's zien? Bootstrap-beheerder, of `dev`-vlag. */
export const heeftDevToegang = (
  persoon: Personeelslid | null,
  email: string | null | undefined,
): boolean => isBootstrapAdmin(email) || persoon?.dev === true;
