import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Badges } from "./pages/Badges";
import { Doelen } from "./pages/Doelen";
import { Foutpagina } from "./pages/Foutpagina";
import { Groepen } from "./pages/Groepen";
import { Students } from "./pages/Students";
import { StudentDetail } from "./pages/StudentDetail";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <Foutpagina />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "badges", element: <Badges /> },
      { path: "doelen", element: <Doelen /> },
      { path: "groepen", element: <Groepen /> },
      { path: "students", element: <Students /> },
      { path: "students/:studentId", element: <StudentDetail /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
