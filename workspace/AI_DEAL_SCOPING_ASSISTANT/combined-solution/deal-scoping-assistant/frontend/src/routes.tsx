import { createBrowserRouter, Navigate } from "react-router"
import {
  ArchitecturePage,
  DataIntegrationAiPage,
  EstimatePage,
  PackagePage,
  PrdScopePage,
  RequirementsPage,
  ScenariosPage,
  SessionsPage,
} from "@/pages/lazyPages"
import NotFoundPage from "@/pages/NotFoundPage"
import PublicLayout from "@/pages/PublicLayout"
import RootLayout from "@/pages/RootLayout"
import RouteErrorPage from "@/pages/RouteErrorPage"
import SessionRoute from "@/pages/SessionRoute"

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: "/", element: <SessionsPage /> },
          { path: "/scenarios", element: <ScenariosPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
      {
        path: "/sessions/:sessionId",
        element: <SessionRoute />,
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, element: <Navigate to="requirements" replace /> },
          { path: "requirements", element: <RequirementsPage /> },
          { path: "prd-scope", element: <PrdScopePage /> },
          { path: "architecture", element: <ArchitecturePage /> },
          { path: "data-integration-ai", element: <DataIntegrationAiPage /> },
          { path: "estimate", element: <EstimatePage /> },
          { path: "package", element: <PackagePage /> },
        ],
      },
    ],
  },
])
