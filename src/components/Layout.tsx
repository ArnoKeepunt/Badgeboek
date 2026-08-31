import { NavLink, Outlet } from "react-router-dom";
import "./Layout.css";

const nav = [
  { to: "/", label: "Overzicht", end: true },
  { to: "/doelen", label: "Doelen", end: false },
  { to: "/students", label: "Leerlingen", end: false },
];

export function Layout() {
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
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
