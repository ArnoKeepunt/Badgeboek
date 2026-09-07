import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useZichtbareLeerlingen } from "../lib/rechten";
import { type Aangemeld, naamVan, useAangemeld, useEffectieveRol } from "../lib/sessie";
import { meldAf } from "../lib/store";
import type { Student } from "../lib/types";
import { Icoon, type IcoonNaam } from "./Icoon";
import { SchooljaarKiezer } from "./SchooljaarKiezer";
import "./Layout.css";

const NAV_INGEKLAPT_KEY = "keerpunt-badgeboek:nav-ingeklapt";

function loadIngeklapt(): boolean {
  try {
    return localStorage.getItem(NAV_INGEKLAPT_KEY) === "1";
  } catch {
    return false;
  }
}

const PAGINA_TITELS: Record<string, string> = {
  "/badges": "Badgeboek — dagelijks werk",
  "/deelevaluaties": "Deelbadges",
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
      { to: "/deelevaluaties", label: "Deelbadges", end: false, icoon: "deelevaluaties" },
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

function UitIcoon() {
  return (
    <svg className="sidebar-account-actie-icoon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 2.5H3.5v11H6M10.5 11l3-3-3-3M13 8H6.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Het Keerpunt-merkteken (dezelfde vorm als de favicon), links van "Badgeboek". */
function LogoIcoon() {
  return (
    <svg className="brand-mark" viewBox="0 0 48 46" fill="none" aria-hidden="true">
      <path
        d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Zijbalk-paneeltje met een chevron erin — leest als "navigatie in-/uitklappen", niet als terug. */
function PaneelIcoon({ ingeklapt }: { ingeklapt: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.75" y="4" width="14.5" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 4v12" stroke="currentColor" strokeWidth="1.4" />
      <path
        d={ingeklapt ? "M11 7.5 13.5 10 11 12.5" : "M13 7.5 10.5 10 13 12.5"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SidebarAccount({ aangemeld, ingeklapt }: { aangemeld: Aangemeld; ingeklapt: boolean }) {
  const naam = aangemeld ? naamVan(aangemeld) : "Beheerder";
  const rol = aangemeld ? aangemeld.rol : "volledige toegang";
  return (
    <div className="sidebar-account">
      <div className="sidebar-account-hoofd" title={ingeklapt ? `${naam} · ${rol}` : undefined}>
        <span className="sidebar-avatar" aria-hidden="true">
          {aangemeld ? initialen(naam) : "BH"}
        </span>
        <span className="sidebar-account-tekst">
          <span className="sidebar-account-naam">{naam}</span>
          <span className="sidebar-account-rol">{rol}</span>
        </span>
      </div>
      {aangemeld ? (
        <button
          type="button"
          className="sidebar-account-actie"
          onClick={() => meldAf()}
          title={ingeklapt ? "Afmelden" : undefined}
        >
          <span className="sidebar-account-actie-tekst">Afmelden</span>
          <UitIcoon />
        </button>
      ) : (
        <NavLink
          to="/aanmelden"
          className="sidebar-account-actie"
          title={ingeklapt ? "Aanmelden" : undefined}
        >
          <span className="sidebar-account-actie-tekst">Aanmelden</span>
          <UitIcoon />
        </NavLink>
      )}
    </div>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const aangemeld = useAangemeld();
  const rol = useEffectieveRol();
  const students = useZichtbareLeerlingen();
  const isLeerling = rol === "leerling";
  const nav = isLeerling ? leerlingNav : rol === "mentor" ? mentorNav : beheerderNav;
  const breed =
    !isLeerling && (pathname.startsWith("/badges") || pathname.startsWith("/students/"));
  const titel = paginaTitel(pathname, students);

  const [ingeklapt, setIngeklapt] = useState(loadIngeklapt);
  useEffect(() => {
    try {
      localStorage.setItem(NAV_INGEKLAPT_KEY, ingeklapt ? "1" : "0");
    } catch {
      // opslag niet beschikbaar — stand geldt enkel voor deze sessie
    }
  }, [ingeklapt]);

  return (
    <div className={`layout${ingeklapt ? " layout--ingeklapt" : ""}`}>
      <aside className={`sidebar${ingeklapt ? " sidebar--ingeklapt" : ""}`}>
        <div className="brand">
          <LogoIcoon />
          <span className="brand-tekst">Badgeboek</span>
        </div>
        <nav>
          {nav.map((groep, i) => (
            <div key={groep.items[0]?.to ?? i} className="nav-groep">
              {groep.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className="nav-link"
                  title={ingeklapt ? item.label : undefined}
                >
                  <Icoon naam={item.icoon} className="nav-icoon" />
                  <span className="nav-link-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-voet">
          <button
            type="button"
            className="sidebar-inklap"
            aria-label={ingeklapt ? "Navigatie uitklappen" : "Navigatie inklappen"}
            aria-pressed={ingeklapt}
            title={ingeklapt ? "Navigatie uitklappen" : "Navigatie inklappen"}
            onClick={() => setIngeklapt((v) => !v)}
          >
            <PaneelIcoon ingeklapt={ingeklapt} />
            <span className="nav-link-label">{ingeklapt ? "Uitklappen" : "Inklappen"}</span>
          </button>
          <SidebarAccount aangemeld={aangemeld} ingeklapt={ingeklapt} />
        </div>
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
