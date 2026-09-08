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
  mentor: "Enkel de leerlingen van de eigen vestiging.",
};

/** Eén personeelsaccount uit Firestore (`gebruikers/{email}`). Nooit een wachtwoord. */
export interface Personeelslid {
  email: string;
  naam: string;
  rol: PersoneelRol;
  /** Enkel betekenisvol bij `rol: "mentor"`; anders `""`. */
  vestiging: string;
  actief: boolean;
}

/** Deze mail kan altijd binnen (spiegelt `isBootstrapAdmin()` in firestore.rules). */
export const BOOTSTRAP_ADMIN = "arno.boriau@keerpuntscholen.be";

export const isBootstrapAdmin = (email: string | null | undefined): boolean =>
  (email ?? "").toLowerCase() === BOOTSTRAP_ADMIN;
