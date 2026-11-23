import { Link, useRouteError } from "react-router"
import { ErrorState } from "@/components/shared/ErrorState"
import { Button } from "@/components/ui/button"

/** Shown when a screen fails to render, so one broken part never blanks the whole app. */
export default function RouteErrorPage() {
  const cause = useRouteError()
  const error = cause instanceof Error ? cause : new Error("This screen could not be shown.")

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-8">
      <h1 className="text-lg font-medium">Something went wrong on this screen</h1>
      <ErrorState error={error} />
      <Button asChild variant="outline" className="self-start">
        <Link to="/">Back to sessions</Link>
      </Button>
    </main>
  )
}
