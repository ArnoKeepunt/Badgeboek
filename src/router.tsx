import { type ReactNode, lazy, Suspense } from "react";
import { createHashRouter } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Aanmelden } from "./pages/Aanmelden";
import { Foutpagina } from "./pages/Foutpagina";
import { Groepen } from "./pages/Groepen";
import { Home } from "./pages/Home";
import { LeerlingCursus } from "./pages/LeerlingCursus";
import { Students } from "./pages/Students";
import { StudentDetail } from "./pages/StudentDetail";
import { NotFound } from "./pages/NotFound";

// Badges, Doelen en Gegevens laden forse curriculum-/eindtermendata — apart inladen.
// oxlint-disable-next-line react/only-export-components
const Badges = lazy(() => import("./pages/Badges").then((m) => ({ default: m.Badges })));
// oxlint-disable-next-line react/only-export-components
const Doelen = lazy(() => import("./pages/Doelen").then((m) => ({ default: m.Doelen })));
// oxlint-disable-next-line react/only-export-components
const Gegevens = lazy(() => import("./pages/Gegevens").then((m) => ({ default: m.Gegevens })));

const traag = (node: ReactNode) => (
  <Suspense fallback={<p style={{ padding: 24, color: "var(--text-muted)" }}>Laden…</p>}>
    {node}
  </Suspense>
);

// Hash-routing (URLs met `/#/...`): de dist-map werkt zo op elk (sub)pad zonder serverconfig
// voor SPA-fallback. Wil je nette URLs? Zet dit terug naar `createBrowserRouter` + regel een
// rewrite (alle paden → index.html) op de host.
export const router = createHashRouter([
  {
    path: "/",
    element: <Shell />,
    errorElement: <Foutpagina />,
    children: [
      { index: true, element: <Home /> },
      { path: "aanmelden", element: <Aanmelden /> },
      { path: "vak/:cursusId", element: <LeerlingCursus /> },
      { path: "badges", element: traag(<Badges />) },
      { path: "doelen", element: traag(<Doelen />) },
      { path: "groepen", element: <Groepen /> },
      { path: "gegevens", element: traag(<Gegevens />) },
      { path: "students", element: <Students /> },
      { path: "students/:studentId", element: <StudentDetail /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
