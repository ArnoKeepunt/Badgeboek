import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** Vriendelijke foutkaart, gedeeld door de 404-pagina en de crash-pagina. */
export function Foutmelding({
  emoji = "🙃",
  titel,
  children,
  detail,
}: {
  emoji?: string;
  titel: string;
  children: ReactNode;
  detail?: string;
}) {
  return (
    <div className="foutpagina">
      <div className="foutpagina-emoji" aria-hidden="true">
        {emoji}
      </div>
      <h1>{titel}</h1>
      <p>{children}</p>
      {detail && <pre className="foutpagina-detail">{detail}</pre>}
      <Link to="/" className="knop-primair foutpagina-knop">
        Terug naar de startpagina
      </Link>
    </div>
  );
}
