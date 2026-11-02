import { type ReactNode, lazy, Suspense } from "react";
import { createHashRouter } from "react-router-dom";
import { AlleenBeheerder } from "./components/AlleenBeheerder";
import { AlleenDev } from "./components/AlleenDev";
import { AlleenPersoneel } from "./components/AlleenPersoneel";
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
const Rapport = lazy(() => import("./pages/Rapport").then((m) => ({ default: m.Rapport })));
// oxlint-disable-next-line react/only-export-components
const RapportDetail = lazy(() =>
  import("./pages/RapportDetail").then((m) => ({ default: m.RapportDetail })),
);
// oxlint-disable-next-line react/only-export-components
const LeerlingRapporten = lazy(() =>
  import("./pages/LeerlingRapporten").then((m) => ({ default: m.LeerlingRapporten })),
);
// oxlint-disable-next-line react/only-export-components
const Deelevaluaties = lazy(() =>
  import("./pages/Deelevaluaties").then((m) => ({ default: m.Deelevaluaties })),
);
// oxlint-disable-next-line react/only-export-components
const Rubrics = lazy(() => import("./pages/Rubrics").then((m) => ({ default: m.Rubrics })));
// oxlint-disable-next-line react/only-export-components
const Doelen = lazy(() => import("./pages/Doelen").then((m) => ({ default: m.Doelen })));
// oxlint-disable-next-line react/only-export-components
const Gegevens = lazy(() => import("./pages/Gegevens").then((m) => ({ default: m.Gegevens })));
// oxlint-disable-next-line react/only-export-components
const Gebruikers = lazy(() => import("./pages/Gebruikers").then((m) => ({ default: m.Gebruikers })));
// oxlint-disable-next-line react/only-export-components
const Vestigingen = lazy(() =>
  import("./pages/Vestigingen").then((m) => ({ default: m.Vestigingen })),
);
// oxlint-disable-next-line react/only-export-components
const BadgesBeheer = lazy(() =>
  import("./pages/BadgesBeheer").then((m) => ({ default: m.BadgesBeheer })),
);

const traag = (node: ReactNode) => (
  <Suspense fallback={<p style={{ padding: 24, color: "var(--text-muted)" }}>Laden…</p>}>
    {node}
  </Suspense>
);

// Personeelspagina's: een leerling (of ouder) komt er ook via een rechtstreekse URL niet in.
const personeel = (node: ReactNode) => <AlleenPersoneel>{node}</AlleenPersoneel>;

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
      { path: "aanmelden", element: <AlleenBeheerder>{<Aanmelden />}</AlleenBeheerder> },
      { path: "vak/:cursusId", element: <LeerlingCursus /> },
      { path: "mijn-rapporten", element: traag(<LeerlingRapporten />) },
      { path: "mijn-rapporten/:rapportId", element: traag(<LeerlingRapporten />) },
      { path: "badges", element: personeel(traag(<Badges />)) },
      { path: "rapport", element: personeel(traag(<Rapport />)) },
      { path: "rapport/:studentId", element: personeel(traag(<RapportDetail />)) },
      {
        path: "deelevaluaties",
        element: personeel(<AlleenDev>{traag(<Deelevaluaties />)}</AlleenDev>),
      },
      { path: "rubrics", element: personeel(traag(<Rubrics />)) },
      { path: "doelen", element: personeel(traag(<Doelen />)) },
      { path: "groepen", element: personeel(<Groepen />) },
      { path: "badges-beheer", element: <AlleenBeheerder>{traag(<BadgesBeheer />)}</AlleenBeheerder> },
      {
        path: "gegevens",
        element: (
          <AlleenBeheerder>{traag(<Gegevens />)}</AlleenBeheerder>
        ),
      },
      {
        path: "gebruikers",
        element: (
          <AlleenBeheerder>{traag(<Gebruikers />)}</AlleenBeheerder>
        ),
      },
      {
        path: "vestigingen",
        element: (
          <AlleenBeheerder>{traag(<Vestigingen />)}</AlleenBeheerder>
        ),
      },
      { path: "students", element: personeel(<Students />) },
      { path: "students/:studentId", element: personeel(<StudentDetail />) },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
