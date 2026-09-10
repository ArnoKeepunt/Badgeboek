/** De personeelsrollen. `mentor` is vestiging-gebonden; `coordinator` en `beheerder` niet. */
export type PersoneelRol = "beheerder" | "coordinator" | "mentor";

export const PERSONEEL_ROLLEN: PersoneelRol[] = ["mentor", "coordinator", "beheerder"];

export const PERSONEEL_ROL_LABEL: Record<PersoneelRol, string> = {
  beheerder: "Beheerder",
  coordinator: "Coördinator",
  mentor: "Mentor",
};

export const PERSONEEL_ROL_UITLEG: Record<PersoneelRol, string> = {
  beheerder: "Volledige toegang, inclusief accountbeheer en de gegevens-/badgesinstellingen.",
  coordinator: "Alle vestigingen zien en evalueren, maar geen accountbeheer of instellingen.",
  mentor: "Enkel de leerlingen van de aangevinkte vestiging(en).",
};

/** Eén personeelsaccount uit Firestore (`gebruikers/{email}`). Nooit een wachtwoord. */
export interface Personeelslid {
  email: string;
  naam: string;
  rol: PersoneelRol;
  /**
   * De vestigingen waar deze mentor toegang toe heeft (een mentor kan aan meerdere campussen
   * lesgeven). Enkel betekenisvol bij `rol: "mentor"`; `coordinator`/`beheerder` zien sowieso
   * alles. Leeg bij een mentor = (nog) geen enkele vestiging → ziet niets.
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
