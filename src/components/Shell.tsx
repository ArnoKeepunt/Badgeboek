import { useEffectieveRol } from "../lib/sessie";
import { Layout } from "./Layout";
import { LeerlingShell } from "./LeerlingShell";

/** Kiest de layout op basis van de rol: leerlingen krijgen een aparte, eenvoudige weergave. */
export function Shell() {
  const rol = useEffectieveRol();
  return rol === "leerling" ? <LeerlingShell /> : <Layout />;
}
