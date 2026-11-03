import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { meldAfVanFirebase } from "../lib/data";
import { useAuthStatus } from "../lib/firebaseAuth";
import { naamVan, useAangemeld } from "../lib/sessie";
import { meldAf } from "../lib/store";
import { MeldingenKlok } from "./MeldingenKlok";
import "./Leerling.css";

/** "Emma Janssens" → "EJ". */
const initialen = (naam: string) =>
  naam
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

/**
 * Aparte, eenvoudige layout voor leerlingen: enkel een balk bovenaan, geen zijbalk.
 * Alle inhoud staat groot en centraal.
 */
export function LeerlingShell() {
  const aangemeld = useAangemeld();
  // Echt aangemeld als leerling (Smartschool) → afmelden = uit de app. Anders is dit het
  // "bekijk als" van een beheerder → terug naar de beheerder.
  const { leerlingId } = useAuthStatus();
  const { pathname } = useLocation();
  // "Mijn badges" = de startpagina én de cursuspagina's (`/vak/...`).
  const rapportenActief = pathname.startsWith("/mijn-rapporten");

  return (
    <div className="ll-shell">
      <header className="ll-topbar">
        {/* Binnenste kolom = zelfde breedte als de inhoud, zodat logo en knoppen erboven uitlijnen. */}
        <div className="ll-topbar-binnen">
          <Link
            to="/"
            className="ll-brand"
            aria-label="Mijn badgeboek — startpagina"
          >
            <svg
              className="ll-brand-icoon"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
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
              <path
                d="M7 10.5h10"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
            <span className="ll-brand-tekst">Mijn badgeboek</span>
          </Link>
          {aangemeld?.rol === "leerling" && (
            <nav className="ll-tabs" aria-label="Hoofdmenu">
              <NavLink
                to="/"
                className={`ll-tab${rapportenActief ? "" : " is-actief"}`}
              >
                Mijn badges
              </NavLink>
              <NavLink
                to="/mijn-rapporten"
                className={`ll-tab${rapportenActief ? " is-actief" : ""}`}
              >
                Mijn rapporten
              </NavLink>
            </nav>
          )}
          {aangemeld && (
            <div className="ll-account">
              {aangemeld.rol === "leerling" && (
                <MeldingenKlok studentId={aangemeld.leerling.id} />
              )}
              {/* Gsm: de naam als rondje met initialen (volledige naam in de tooltip). */}
              <span className="ll-naam">{naamVan(aangemeld)}</span>
              <span
                className="ll-avatar"
                title={naamVan(aangemeld)}
                aria-hidden="true"
              >
                {initialen(naamVan(aangemeld))}
              </span>
              <button
                type="button"
                className="ll-afmelden"
                aria-label="Afmelden"
                title="Afmelden"
                onClick={() =>
                  leerlingId ? void meldAfVanFirebase() : meldAf()
                }
              >
                <svg
                  className="ll-afmelden-icoon"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="ll-afmelden-tekst">Afmelden</span>
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="ll-content">
        <Outlet />
      </main>
    </div>
  );
}
