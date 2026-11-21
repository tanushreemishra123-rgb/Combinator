import { useState } from "react"
import { useParams } from "react-router"
import { artifactOf, useArtifacts } from "@/api/hooks/artifacts"
import { useDiagrams } from "@/api/hooks/diagrams"
import { useScope } from "@/api/hooks/scope"
import { useSession } from "@/api/hooks/sessions"
import { AiStrategyView } from "@/components/dataai/AiStrategyView"
import { DataStrategyView } from "@/components/dataai/DataStrategyView"
import { IntegrationInventory } from "@/components/dataai/IntegrationInventory"
import { SystemsPanel } from "@/components/dataai/SystemsPanel"
import { ArtifactStageCard } from "@/components/shared/ArtifactStageCard"
import { DiagramView } from "@/components/shared/DiagramView"
import { ErrorState } from "@/components/shared/ErrorState"
import { LoadingState } from "@/components/shared/LoadingState"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"
import { TraceSheet } from "@/components/shared/TraceSheet"

const NEEDS_ARCHITECTURE = "Design the solution first — these strategies build on its components."

export default function DataIntegrationAiPage() {
  const { sessionId = "" } = useParams<{ sessionId: string }>()
  const session = useSession(sessionId)
  const artifacts = useArtifacts(sessionId)
  const scope = useScope(sessionId)
  const diagrams = useDiagrams(sessionId)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (session.isPending) return <LoadingState lines={6} label="Loading the workspace" />
  if (session.isError) return <ErrorState error={session.error} onRetry={() => session.refetch()} />

  const architecture = artifactOf(artifacts.data, "architecture")
  const data = artifactOf(artifacts.data, "data_strategy")
  const integration = artifactOf(artifacts.data, "integration_architecture")
  const ai = artifactOf(artifacts.data, "ai_strategy")
  const blocked = architecture ? null : NEEDS_ARCHITECTURE

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Plan the data flow and select the AI approach"
        description="How data moves, and where AI genuinely helps."
      />

      <ArtifactStageCard
        sessionId={sessionId}
        kind="data_strategy"
        description="Domains, storage, governance, retention, privacy, recovery."
        artifact={data}
        blockedReason={blocked}
      />
      {data ? (
        <SectionCard title="Data strategy">
          <DataStrategyView
            strategy={data.content}
            components={architecture?.content.components}
            onSelectId={setSelectedId}
          />
        </SectionCard>
      ) : null}

      <ArtifactStageCard
        sessionId={sessionId}
        kind="integration_architecture"
        artifact={integration}
        blockedReason={blocked}
      />
      {integration ? (
        <>
          <SectionCard title="Integration inventory">
            <IntegrationInventory
              integrations={integration.content.integrations}
              onSelectId={setSelectedId}
            />
          </SectionCard>
          <SectionCard title="Systems in scope">
            <div className="flex flex-col gap-6">
              <SystemsPanel
                title="Internal systems"
                systems={integration.content.internal_systems}
                onSelectId={setSelectedId}
              />
              <SystemsPanel
                title="External systems"
                systems={integration.content.external_systems}
                onSelectId={setSelectedId}
              />
            </div>
          </SectionCard>
          {diagrams.data?.integration_mermaid ? (
            <SectionCard title="Data and integration diagram">
              <DiagramView
                source={diagrams.data.integration_mermaid}
                title="Data and integration diagram"
              />
            </SectionCard>
          ) : null}
        </>
      ) : null}

      <ArtifactStageCard
        sessionId={sessionId}
        kind="ai_strategy"
        description="Use cases, providers and frameworks."
        artifact={ai}
        blockedReason={blocked}
      />
      {ai ? (
        <AiStrategyView
          strategy={ai.content}
          platform={session.data.cloud_platform}
          onSelectId={setSelectedId}
        />
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
