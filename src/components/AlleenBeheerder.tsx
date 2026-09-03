import type { ReactNode } from "react";
import { useEffectieveRol } from "../lib/sessie";

/**
 * Routewachter: toont de inhoud enkel voor de beheerder. Mentoren (en leerlingen) krijgen een
 * "geen toegang"-melding — ook als ze de URL rechtstreeks intikken.
 */
export function AlleenBeheerder({ children }: { children: ReactNode }) {
  const rol = useEffectieveRol();
  if (rol === "beheerder") return <>{children}</>;
  return (
    <section>
      <p className="lege-staat">
        Deze pagina is alleen voor de beheerder. Meld je aan als beheerder om verder te gaan.
      </p>
    </section>
  );
}
