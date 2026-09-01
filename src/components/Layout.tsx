import { NavLink, Outlet, useLocation } from "react-router-dom";
import { SchooljaarKiezer } from "./SchooljaarKiezer";
import "./Layout.css";

const nav = [
  { to: "/", label: "Overzicht", end: true },
  { to: "/badges", label: "Badges", end: false },
  { to: "/doelen", label: "Doelen", end: false },
  { to: "/groepen", label: "Groepen", end: false },
  { to: "/students", label: "Leerlingen", end: false },
];

export function Layout() {
  const { pathname } = useLocation();
  // De badgematrix mag de volledige breedte gebruiken (en daarna horizontaal scrollen).
  const breed = pathname.startsWith("/badges");

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Badgeboek</div>
        <nav>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="nav-link"
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="topbar-title">Badgeboek — dagelijks werk</span>
          <SchooljaarKiezer />
        </header>
        <main className={`content${breed ? " content--breed" : ""}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
