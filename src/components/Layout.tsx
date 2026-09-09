import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { PERSISTENTIE_MODUS, meldAfVanFirebase } from "../lib/data";
import { useDevToegang, useFirebaseGebruiker, useHuidigPersoneelslid } from "../lib/firebaseAuth";
import { PERSONEEL_ROL_LABEL } from "../lib/gebruikers";
import { useZichtbareLeerlingen } from "../lib/rechten";
import { type Aangemeld, naamVan, useAangemeld, useEffectieveRol } from "../lib/sessie";
import { meldAf } from "../lib/store";
import type { Student } from "../lib/types";
import { Icoon, type IcoonNaam } from "./Icoon";
import { LogoIcoon } from "./LogoIcoon";
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
  "/gebruikers": "Gebruikers",
  "/vestigingen": "Vestigingen",
  "/gegevens": "Gegevens",
  "/aanmelden": "Bekijk als",
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
const overzichtGroep: NavGroep = {
  items: [{ to: "/", label: "Overzicht", end: true, icoon: "overzicht" }],
};
const leerlingenItem: NavItem = {
  to: "/students",
  label: "Leerlingen",
  end: false,
  icoon: "leerlingen",
};
const groepenItem: NavItem = { to: "/groepen", label: "Groepen", end: false, icoon: "groepen" };
const doelenGroep: NavGroep = {
  items: [{ to: "/doelen", label: "Doelen", end: false, icoon: "doelen" }],
};

// Deelbadges + Rubrics zijn nog niet af / niet de focus → alleen zichtbaar voor de
// bootstrap-beheerder (Arno), of in local-modus (dev).
const devItems: NavItem[] = [
  { to: "/deelevaluaties", label: "Deelbadges", end: false, icoon: "deelevaluaties" },
  { to: "/rubrics", label: "Rubrics", end: false, icoon: "rubrics" },
];

// Mentor: badgeboek + leerlingen + naslag. Groepen maak je inline in de keuzelijsten, dus de
// aparte Groepen-pagina is voor "meer rechten" (beheerder).
const mentorNav: NavGroep[] = [
  overzichtGroep,
  { items: [{ to: "/badges", label: "Badges", end: false, icoon: "badges" }] },
  { items: [leerlingenItem] },
  doelenGroep,
];

const beheerderNav = (dev: boolean): NavGroep[] => [
  overzichtGroep,
  { items: [{ to: "/badges", label: "Badges", end: false, icoon: "badges" }, ...(dev ? devItems : [])] },
  { items: [groepenItem, leerlingenItem] },
  doelenGroep,
  {
    items: [
      // Accountbeheer heeft de Firestore-database nodig; in local-modus geen nut.
      ...(PERSISTENTIE_MODUS === "firebase"
        ? [{ to: "/gebruikers", label: "Gebruikers", end: false, icoon: "gebruikers" as const }]
        : []),
      { to: "/vestigingen", label: "Vestigingen", end: false, icoon: "vestigingen" },
      { to: "/gegevens", label: "Gegevens", end: false, icoon: "gegevens" },
    ],
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
  const { persoon } = useHuidigPersoneelslid();
  const { gebruiker } = useFirebaseGebruiker();
  const effRol = useEffectieveRol();
  // "Bekijk als" is een beheerderrecht. In bekijk-als-modus (`aangemeld`) is de kijker per
  // definitie een beheerder; anders telt de echte rol.
  const magBekijkenAls = aangemeld ? true : effRol === "beheerder";
  const email = gebruiker?.email ?? gebruiker?.displayName ?? null;
  // Toon de "bekijk als"-identiteit als die actief is, anders het echte personeelsaccount.
  const naam = aangemeld ? naamVan(aangemeld) : (persoon?.naam ?? "Beheerder");
  const rol = aangemeld
    ? aangemeld.rol
    : persoon
      ? PERSONEEL_ROL_LABEL[persoon.rol] +
        (persoon.rol === "mentor" && persoon.vestiging ? ` · ${persoon.vestiging}` : "")
      : "volledige toegang";
  return (
    <div className="sidebar-account">
      <div className="sidebar-account-hoofd" title={ingeklapt ? `${naam} · ${rol}` : undefined}>
        <span className="sidebar-avatar" aria-hidden="true">
          {naam && naam !== "Beheerder" ? initialen(naam) : "BH"}
        </span>
        <span className="sidebar-account-tekst">
          <span className="sidebar-account-naam">{naam}</span>
          <span className="sidebar-account-rol">{rol}</span>
        </span>
      </div>

      {aangemeld && (
        <button
          type="button"
          className="sidebar-account-actie"
          onClick={() => meldAf()}
          title={ingeklapt ? "Terug naar beheerder" : undefined}
        >
          <span className="sidebar-account-actie-tekst">Stop bekijken als</span>
          <UitIcoon />
        </button>
      )}

      {gebruiker && (
        <button
          type="button"
          className="sidebar-account-actie"
          onClick={() => void meldAfVanFirebase()}
          title={ingeklapt ? "Afmelden" : undefined}
        >
          <span className="sidebar-account-actie-tekst">Afmelden</span>
          <UitIcoon />
        </button>
      )}

      {email && (
        <span className="sidebar-google-mail" title={email}>
          {email}
        </span>
      )}

      {/* "Bekijk als" is zelden nodig → apart, onderaan, ingetogen. */}
      {magBekijkenAls && !aangemeld && (
        <NavLink
          to="/aanmelden"
          className="sidebar-account-actie sidebar-account-actie-subtiel"
          title={ingeklapt ? "Bekijk als leerling of mentor" : undefined}
        >
          <span className="sidebar-account-actie-tekst">Bekijk als…</span>
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
  // Deelbadges/Rubrics: bootstrap-beheerder, iemand met de `dev`-vlag, of local-(dev-)modus.
  const dev = useDevToegang();
  const nav = isLeerling
    ? leerlingNav
    : rol === "beheerder"
      ? beheerderNav(dev)
      : mentorNav;
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
