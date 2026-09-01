import { Link, Outlet } from "react-router-dom";
import { naamVan, useAangemeld } from "../lib/sessie";
import { meldAf } from "../lib/store";

/**
 * Aparte, eenvoudige layout voor leerlingen: enkel een balk bovenaan, geen zijbalk.
 * Alle inhoud staat groot en centraal.
 */
export function LeerlingShell() {
  const aangemeld = useAangemeld();

  return (
    <div className="ll-shell">
      <header className="ll-topbar">
        <Link to="/" className="ll-brand">
          🎒 Mijn badgeboek
        </Link>
        {aangemeld && (
          <div className="ll-account">
            <span>{naamVan(aangemeld)}</span>
            <button type="button" className="ll-afmelden" onClick={() => meldAf()}>
              Afmelden
            </button>
          </div>
        )}
      </header>
      <main className="ll-content">
        <Outlet />
      </main>
    </div>
  );
}
