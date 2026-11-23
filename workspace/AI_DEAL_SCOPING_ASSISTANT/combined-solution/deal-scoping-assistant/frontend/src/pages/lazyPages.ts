import { lazy } from "react"

// Each workspace is its own chunk: opening a session should not download the estimate
// engine, the package export or the diagram renderer.
export const SessionsPage = lazy(() => import("@/pages/SessionsPage"))
export const ScenariosPage = lazy(() => import("@/pages/ScenariosPage"))
export const RequirementsPage = lazy(() => import("@/pages/RequirementsPage"))
export const PrdScopePage = lazy(() => import("@/pages/PrdScopePage"))
export const ArchitecturePage = lazy(() => import("@/pages/ArchitecturePage"))
export const DataIntegrationAiPage = lazy(() => import("@/pages/DataIntegrationAiPage"))
export const EstimatePage = lazy(() => import("@/pages/EstimatePage"))
export const PackagePage = lazy(() => import("@/pages/PackagePage"))
