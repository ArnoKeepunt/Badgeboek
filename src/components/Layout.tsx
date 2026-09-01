import { NavLink, Outlet, useLocation } from "react-router-dom";
import { type Aangemeld, naamVan, useAangemeld } from "../lib/sessie";
import { meldAf } from "../lib/store";
import { SchooljaarKiezer } from "./SchooljaarKiezer";
import "./Layout.css";

const mentorNav = [
  { to: "/", label: "Overzicht", end: true },
  { to: "/badges", label: "Badges", end: false },
  { to: "/doelen", label: "Doelen", end: false },
  { to: "/groepen", label: "Groepen", end: false },
  { to: "/students", label: "Leerlingen", end: false },
  { to: "/gegevens", label: "Gegevens", end: false },
];

const leerlingNav = [{ to: "/", label: "Mijn badges", end: true }];

function initialen(naam: string): string {
  return naam
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function SidebarAccount({ aangemeld }: { aangemeld: Aangemeld }) {
  const naam = aangemeld ? naamVan(aangemeld) : "Beheerder";
  const rol = aangemeld ? aangemeld.rol : "volledige toegang";
  return (
    <div className="sidebar-account">
      <div className="sidebar-account-hoofd">
        <span className="sidebar-avatar" aria-hidden="true">
          {aangemeld ? initialen(naam) : "BH"}
        </span>
        <span className="sidebar-account-tekst">
          <span className="sidebar-account-naam">{naam}</span>
          <span className="sidebar-account-rol">{rol}</span>
        </span>
      </div>
      {aangemeld ? (
        <button type="button" className="sidebar-account-actie" onClick={() => meldAf()}>
          Afmelden
        </button>
      ) : (
        <NavLink to="/aanmelden" className="sidebar-account-actie">
          Aanmelden
        </NavLink>
      )}
    </div>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const aangemeld = useAangemeld();
  const isLeerling = aangemeld?.rol === "leerling";
  const nav = isLeerling ? leerlingNav : mentorNav;
  const breed = !isLeerling && pathname.startsWith("/badges");

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Badgeboek</div>
        <nav>
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
        <SidebarAccount aangemeld={aangemeld} />
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="topbar-title">Badgeboek — dagelijks werk</span>
          {!isLeerling && <SchooljaarKiezer />}
        </header>
        <main className={`content${breed ? " content--breed" : ""}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
