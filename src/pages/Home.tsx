import { useAangemeld } from "../lib/sessie";
import { Dashboard } from "./Dashboard";
import { LeerlingHome } from "./LeerlingHome";

/** Startpagina: leerlingen zien hun eigen overzicht, iedereen anders het mentor-dashboard. */
export function Home() {
  const aangemeld = useAangemeld();
  if (aangemeld?.rol === "leerling") return <LeerlingHome leerling={aangemeld.leerling} />;
  return <Dashboard />;
}
