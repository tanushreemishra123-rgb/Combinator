import { Suspense } from "react"
import { Outlet } from "react-router"
import { LoadingState } from "@/components/shared/LoadingState"

/** Only the lazy-chunk boundary; each area brings its own shell. */
export default function RootLayout() {
  return (
    <Suspense fallback={<LoadingState lines={6} label="Loading the page" className="p-8" />}>
      <Outlet />
    </Suspense>
  )
}
