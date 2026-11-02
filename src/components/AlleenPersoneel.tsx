import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useEffectieveRol } from "../lib/sessie";

/**
 * Routewachter: houdt leerlingen (en dus ook ouders, die via het leerlingaccount kijken) weg van
 * de personeelspagina's — ook als ze de URL rechtstreeks intikken. Bv. de rapportmodule: een
 * leerling ziet enkel zijn afgewerkte rapporten, onder "Mijn rapporten".
 */
export function AlleenPersoneel({ children }: { children: ReactNode }) {
  const rol = useEffectieveRol();
  if (rol !== "leerling") return <>{children}</>;
  return (
    <div className="ll-leeg">
      <p>Deze pagina is niet beschikbaar.</p>
      <Link to="/" className="ll-terug">
        ← Terug naar mijn badges
      </Link>
    </div>
  );
}
