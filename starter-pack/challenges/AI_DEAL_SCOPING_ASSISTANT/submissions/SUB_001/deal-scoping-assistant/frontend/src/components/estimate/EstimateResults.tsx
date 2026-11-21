import { MissingInputsAlert } from "@/components/estimate/MissingInputsAlert"
import { PhaseTimeline } from "@/components/estimate/PhaseTimeline"
import { TotalsPanel } from "@/components/estimate/TotalsPanel"
import { WorkstreamTable } from "@/components/estimate/WorkstreamTable"
import { StatementSection } from "@/components/prd/StatementSection"
import { SectionCard } from "@/components/shared/SectionCard"
import type { Estimate, EstimateDrivers } from "@/api/types"

interface EstimateResultsProps {
  estimate: Estimate
  drivers: EstimateDrivers | undefined
  onSelectId?: (id: string) => void
}

export function EstimateResults({ estimate, drivers, onSelectId }: EstimateResultsProps) {
  return (
    <div className="flex flex-col gap-6">
      <MissingInputsAlert missing={estimate.missing_inputs} blocked={estimate.blocked_lines} />
      <SectionCard
        title="Effort, timeline and ROM"
        description="Every figure is reproducible from the inputs above."
      >
        <TotalsPanel estimate={estimate} />
      </SectionCard>
      <SectionCard title="Delivery phases and milestones">
        <PhaseTimeline phases={estimate.phases} />
      </SectionCard>
      <SectionCard title="Workstreams">
        <WorkstreamTable workstreams={estimate.workstreams} onSelectId={onSelectId} />
      </SectionCard>
      {estimate.assumptions.length > 0 ? (
        <SectionCard title="Estimation assumptions">
          <ul className="flex list-disc flex-col gap-1 pl-4 text-sm">
            {estimate.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
      {drivers ? (
        <SectionCard title="Delivery risks and exclusions">
          <div className="flex flex-col gap-6">
            <StatementSection
              title="Delivery risks"
              statements={drivers.delivery_risks}
              onSelectId={onSelectId}
            />
            <StatementSection
              title="What the estimate excludes"
              statements={drivers.exclusions}
              onSelectId={onSelectId}
            />
            <StatementSection
              title="Assumptions behind the drivers"
              statements={drivers.estimation_assumptions}
              onSelectId={onSelectId}
            />
          </div>
        </SectionCard>
      ) : null}
    </div>
  )
}
