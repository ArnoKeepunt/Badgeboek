import { NavLink, Outlet, useLocation } from "react-router-dom";
import { type Aangemeld, naamVan, useAangemeld, useEffectieveRol } from "../lib/sessie";
import { meldAf, useStore } from "../lib/store";
import type { Student } from "../lib/types";
import { Icoon, type IcoonNaam } from "./Icoon";
import { SchooljaarKiezer } from "./SchooljaarKiezer";
import "./Layout.css";

const PAGINA_TITELS: Record<string, string> = {
  "/badges": "Badges",
  "/deelevaluaties": "Deelevaluaties",
  "/rubrics": "Rubrics",
  "/doelen": "Doelen",
  "/groepen": "Groepen",
  "/students": "Leerlingen",
  "/gegevens": "Gegevens",
  "/aanmelden": "Aanmelden",
};

/** De titel voor de bovenbalk, afgeleid van het huidige pad. */
function paginaTitel(pathname: string, students: Student[]): string {
  if (pathname === "/") return "Overzicht";
  if (pathname.startsWith("/students/")) {
    const id = decodeURIComponent(pathname.slice("/students/".length));
    const s = students.find((x) => x.id === id);
    return s ? `${s.firstName} ${s.lastName}` : "Leerling";
  }
  return PAGINA_TITELS[pathname] ?? "Badgeboek";
}

type NavItem = { to: string; label: string; end: boolean; icoon: IcoonNaam };
type NavGroep = { items: NavItem[] };

// De zijbalk is geordend in blokjes, gescheiden door een lijntje: het overzicht apart, dan
// de evaluatie-onderdelen, het klasbeheer en de naslag. Beheerder krijgt er "Gegevens" bij.
const mentorNav: NavGroep[] = [
  { items: [{ to: "/", label: "Overzicht", end: true, icoon: "overzicht" }] },
  {
    items: [
      { to: "/badges", label: "Badges", end: false, icoon: "badges" },
      { to: "/deelevaluaties", label: "Deelevaluaties", end: false, icoon: "deelevaluaties" },
      { to: "/rubrics", label: "Rubrics", end: false, icoon: "rubrics" },
    ],
  },
  {
    items: [
      { to: "/groepen", label: "Groepen", end: false, icoon: "groepen" },
      { to: "/students", label: "Leerlingen", end: false, icoon: "leerlingen" },
    ],
  },
  {
    items: [{ to: "/doelen", label: "Doelen", end: false, icoon: "doelen" }],
  },
];

const beheerderNav: NavGroep[] = [
  ...mentorNav,
  {
    items: [{ to: "/gegevens", label: "Gegevens", end: false, icoon: "gegevens" }],
  },
];

const leerlingNav: NavGroep[] = [
  { items: [{ to: "/", label: "Mijn badges", end: true, icoon: "badges" }] },
];

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
  const rol = useEffectieveRol();
  const { students } = useStore();
  const isLeerling = rol === "leerling";
  const nav = isLeerling ? leerlingNav : rol === "mentor" ? mentorNav : beheerderNav;
  const breed = !isLeerling && pathname.startsWith("/badges");
  const titel = paginaTitel(pathname, students);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Badgeboek</div>
        <nav>
          {nav.map((groep, i) => (
            <div key={groep.items[0]?.to ?? i} className="nav-groep">
              {groep.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
                  <Icoon naam={item.icoon} className="nav-icoon" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <SidebarAccount aangemeld={aangemeld} />
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="topbar-title">{titel}</span>
          {!isLeerling && <SchooljaarKiezer />}
        </header>
        <main className={`content${breed ? " content--breed" : ""}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
