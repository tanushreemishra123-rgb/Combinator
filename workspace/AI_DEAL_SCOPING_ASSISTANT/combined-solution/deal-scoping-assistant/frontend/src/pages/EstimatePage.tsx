import { useState } from "react"
import { useParams } from "react-router"
import { CalculatorIcon } from "lucide-react"
import { artifactOf, useArtifacts } from "@/api/hooks/artifacts"
import {
  useCalculateEstimate,
  useEstimate,
  useEstimationConfig,
  useHistoricalProjects,
  useRateCards,
} from "@/api/hooks/estimate"
import { useScope } from "@/api/hooks/scope"
import { useSession } from "@/api/hooks/sessions"
import { DriversNotice } from "@/components/estimate/DriversNotice"
import { EstimateResults } from "@/components/estimate/EstimateResults"
import { EstimationConfigForm } from "@/components/estimate/EstimationConfigForm"
import { HistoricalPanel } from "@/components/estimate/HistoricalPanel"
import { RateCardTable } from "@/components/estimate/RateCardTable"
import { UnitsTable } from "@/components/estimate/UnitsTable"
import { ArtifactStageCard } from "@/components/shared/ArtifactStageCard"
import { ErrorState } from "@/components/shared/ErrorState"
import { LoadingState } from "@/components/shared/LoadingState"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"
import { StageButton } from "@/components/shared/StageButton"
import { TraceSheet } from "@/components/shared/TraceSheet"

const PREREQUISITES = [
  "functional_scope",
  "architecture",
  "integration_architecture",
  "ai_strategy",
] as const

export default function EstimatePage() {
  const { sessionId = "" } = useParams<{ sessionId: string }>()
  const session = useSession(sessionId)
  const artifacts = useArtifacts(sessionId)
  const scope = useScope(sessionId)
  const config = useEstimationConfig(sessionId)
  const rateCards = useRateCards()
  const historical = useHistoricalProjects()
  const estimate = useEstimate(sessionId)
  const calculate = useCalculateEstimate(sessionId)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (session.isPending) return <LoadingState lines={6} label="Loading the workspace" />
  if (session.isError) return <ErrorState error={session.error} onRetry={() => session.refetch()} />

  const drivers = artifactOf(artifacts.data, "estimate_drivers")
  const missing = PREREQUISITES.filter((kind) => !artifactOf(artifacts.data, kind))
  const driversBlocked = missing.length
    ? "The drivers need the functional scope, the architecture, the integrations and the AI strategy first."
    : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Estimate the delivery"
        description="Effort, timeline and rough-order-of-magnitude commercials from visible factors."
      />
      <DriversNotice />

      <ArtifactStageCard
        sessionId={sessionId}
        kind="estimate_drivers"
        artifact={drivers}
        blockedReason={driversBlocked}
      />

      {config.data ? (
        <SectionCard
          title="Estimation inputs"
          description="Change these and recalculate; the numbers follow."
        >
          <EstimationConfigForm
            sessionId={sessionId}
            config={config.data.session_config}
            rateCards={rateCards.data ?? []}
            teamSizes={config.data.team_sizes}
            scopeStatus={session.data.scope_status}
          />
        </SectionCard>
      ) : null}

      {drivers ? (
        <SectionCard title="Estimate units and complexity">
          <UnitsTable sessionId={sessionId} drivers={drivers.content} />
        </SectionCard>
      ) : null}

      <SectionCard title="Calculate the estimate">
        <div className="flex flex-col gap-3">
          <StageButton
            running={calculate.isPending}
            stage="Applying the documented rules"
            disabled={!drivers}
            onClick={() => calculate.mutate()}
          >
            <CalculatorIcon data-icon="inline-start" />
            Calculate estimate
          </StageButton>
          {calculate.isError ? <ErrorState error={calculate.error} /> : null}
        </div>
      </SectionCard>

      {estimate.data ? (
        <EstimateResults
          estimate={estimate.data}
          drivers={drivers?.content}
          onSelectId={setSelectedId}
        />
      ) : null}

      <SectionCard title="Rate card">
        <RateCardTable
          rateCard={config.data?.rate_card ?? null}
          overrides={config.data?.session_config.rate_overrides}
        />
      </SectionCard>

      {historical.data ? (
        <SectionCard title="Comparable Topcoder projects">
          <HistoricalPanel reference={historical.data} />
        </SectionCard>
      ) : null}

      <TraceSheet
        sessionId={sessionId}
        selectedId={selectedId}
        scope={scope.data}
        artifacts={artifacts.data}
        readOnly
        onSelectId={setSelectedId}
      />
    </div>
  )
}
