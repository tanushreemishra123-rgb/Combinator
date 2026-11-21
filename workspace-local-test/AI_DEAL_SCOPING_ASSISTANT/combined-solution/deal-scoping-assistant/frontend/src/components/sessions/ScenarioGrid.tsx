import { useNavigate } from "react-router"
import { useCreateSessionFromScenario, useScenarios } from "@/api/hooks/scenarios"
import { ScenarioCard } from "@/components/sessions/ScenarioCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { LoadingState } from "@/components/shared/LoadingState"

export function ScenarioGrid() {
  const scenarios = useScenarios()
  const navigate = useNavigate()
  const start = useCreateSessionFromScenario()

  const startScenario = (slug: string) => {
    start.mutate(slug, {
      onSuccess: (session) => {
        void navigate(`/sessions/${session.id}/requirements`)
      },
    })
  }

  if (scenarios.isPending) return <LoadingState lines={3} label="Loading sample scenarios" />
  if (scenarios.isError)
    return <ErrorState error={scenarios.error} onRetry={() => scenarios.refetch()} />
  if (scenarios.data.length === 0)
    return <EmptyState title="No sample scenarios" description="No seeded scenarios were found." />

  return (
    <div className="flex flex-col gap-4">
      {start.isError ? <ErrorState error={start.error} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {scenarios.data.map((scenario) => (
          <ScenarioCard
            key={scenario.slug}
            scenario={scenario}
            starting={start.isPending && start.variables === scenario.slug}
            onStart={startScenario}
          />
        ))}
      </div>
    </div>
  )
}
