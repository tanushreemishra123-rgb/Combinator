import { useCoverage } from "@/api/hooks/coverage"
import { CoverageMatrix } from "@/components/prd/CoverageMatrix"
import { CoverageSummary } from "@/components/prd/CoverageSummary"
import { UnsupportedAdditions } from "@/components/prd/UnsupportedAdditions"
import { ErrorState } from "@/components/shared/ErrorState"
import { LoadingState } from "@/components/shared/LoadingState"
import { SectionCard } from "@/components/shared/SectionCard"

interface CoverageViewProps {
  sessionId: string
  enabled: boolean
  onSelectId?: (id: string) => void
}

export function CoverageView({ sessionId, enabled, onSelectId }: CoverageViewProps) {
  const coverage = useCoverage(sessionId, { enabled })

  return (
    <SectionCard
      title="Validate requirement coverage"
      description="Which deliverable carries each requirement."
    >
      {!enabled ? (
        <p className="text-sm text-muted-foreground">
          Coverage appears once the functional scope has been generated.
        </p>
      ) : coverage.isPending ? (
        <LoadingState lines={5} label="Loading coverage" />
      ) : coverage.isError ? (
        <ErrorState error={coverage.error} onRetry={() => coverage.refetch()} />
      ) : (
        <div className="flex flex-col gap-4">
          <CoverageSummary report={coverage.data} onSelectId={onSelectId} />
          <UnsupportedAdditions additions={coverage.data.unsupported_additions ?? []} />
          <CoverageMatrix report={coverage.data} onSelectId={onSelectId} />
        </div>
      )}
    </SectionCard>
  )
}
