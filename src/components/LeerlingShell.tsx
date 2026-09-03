import { Link, Outlet } from "react-router-dom";
import { naamVan, useAangemeld } from "../lib/sessie";
import { meldAf } from "../lib/store";
import { MeldingenKlok } from "./MeldingenKlok";

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
          <svg className="ll-brand-icoon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 9a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="M9 21v-5.5A1.5 1.5 0 0 1 10.5 14h3A1.5 1.5 0 0 1 15 15.5V21"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9.5 4.4V4a2.5 2.5 0 0 1 5 0v.4"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <path d="M7 10.5h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          Mijn badgeboek
        </Link>
        {aangemeld && (
          <div className="ll-account">
            {aangemeld.rol === "leerling" && (
              <MeldingenKlok studentId={aangemeld.leerling.id} />
            )}
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
