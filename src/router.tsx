import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Doelen } from "./pages/Doelen";
import { Students } from "./pages/Students";
import { StudentDetail } from "./pages/StudentDetail";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "doelen", element: <Doelen /> },
      { path: "students", element: <Students /> },
      { path: "students/:studentId", element: <StudentDetail /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
