import { ShieldCheckIcon } from "lucide-react"
import { useRunQualityGate } from "@/api/hooks/quality"
import { CheckList } from "@/components/package/CheckList"
import { QualitySummaryTiles } from "@/components/package/QualitySummaryTiles"
import { ValidationItems } from "@/components/package/ValidationItems"
import { ErrorState } from "@/components/shared/ErrorState"
import { SectionCard } from "@/components/shared/SectionCard"
import { StageButton } from "@/components/shared/StageButton"
import type { QualityReport } from "@/api/types"

interface QualityGatePanelProps {
  sessionId: string
  report: QualityReport | undefined
  onSelectId?: (id: string) => void
}

export function QualityGatePanel({ sessionId, report, onSelectId }: QualityGatePanelProps) {
  const run = useRunQualityGate(sessionId)

  return (
    <SectionCard
      title="Quality gate"
      description="Sixteen deterministic checks. No model is involved."
    >
      <div className="flex flex-col gap-5">
        <StageButton
          running={run.isPending}
          stage="Running the checks"
          onClick={() => run.mutate()}
        >
          <ShieldCheckIcon data-icon="inline-start" />
          Run the quality gate
        </StageButton>
        {run.isError ? <ErrorState error={run.error} /> : null}
        {report ? (
          <>
            <QualitySummaryTiles summary={report.summary} />
            <CheckList checks={report.checks} onSelectId={onSelectId} />
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Items requiring human validation</h3>
              <ValidationItems
                items={report.items_requiring_human_validation}
                onSelectId={onSelectId}
              />
            </section>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            The gate has not run for this scope version yet.
          </p>
        )}
      </div>
    </SectionCard>
  )
}
