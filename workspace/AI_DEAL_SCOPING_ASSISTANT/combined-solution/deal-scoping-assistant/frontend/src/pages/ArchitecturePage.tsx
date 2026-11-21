import { useState } from "react"
import { useParams } from "react-router"
import { artifactOf, useArtifacts } from "@/api/hooks/artifacts"
import { useDiagrams } from "@/api/hooks/diagrams"
import { useScope } from "@/api/hooks/scope"
import { useSession } from "@/api/hooks/sessions"
import { ArchitectureSections } from "@/components/architecture/ArchitectureSections"
import { ComponentAreas } from "@/components/architecture/ComponentAreas"
import { ComponentTraceability } from "@/components/architecture/ComponentTraceability"
import { PlatformRecommendationCard } from "@/components/architecture/PlatformRecommendationCard"
import { PlatformSelector } from "@/components/architecture/PlatformSelector"
import {
  platformGenerateOptions,
  platformSelectorState,
} from "@/components/architecture/platformRules"
import type { PlatformChoice } from "@/components/architecture/platformRules"
import { ArtifactStageCard } from "@/components/shared/ArtifactStageCard"
import { DiagramView } from "@/components/shared/DiagramView"
import { ErrorState } from "@/components/shared/ErrorState"
import { LoadingState } from "@/components/shared/LoadingState"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"
import { TraceSheet } from "@/components/shared/TraceSheet"

const NEEDS_APPROVAL = "Approve the requirements first; the architecture is designed from them."
const NEEDS_SCOPE = "Build the functional scope first — the architecture delivers its capabilities."

export default function ArchitecturePage() {
  const { sessionId = "" } = useParams<{ sessionId: string }>()
  const session = useSession(sessionId)
  const artifacts = useArtifacts(sessionId)
  const scope = useScope(sessionId)
  const diagrams = useDiagrams(sessionId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [choice, setChoice] = useState<PlatformChoice | null>(null)

  if (session.isPending) return <LoadingState lines={6} label="Loading the workspace" />
  if (session.isError) return <ErrorState error={session.error} onRetry={() => session.refetch()} />

  const state = platformSelectorState(session.data)
  const platformChoice = choice ?? state.selected
  const architecture = artifactOf(artifacts.data, "architecture")
  const functionalScope = artifactOf(artifacts.data, "functional_scope")
  const recommendation =
    architecture?.content.platform_recommendation ??
    artifactOf(artifacts.data, "platform_recommendation")?.content

  const blockedReason =
    session.data.scope_status !== "approved"
      ? NEEDS_APPROVAL
      : !functionalScope
        ? NEEDS_SCOPE
        : platformChoice
          ? null
          : "Choose a cloud platform, or ask for a recommendation, before designing."

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Design the solution"
        description="Every component names the requirement that justifies it."
      />
      <PlatformSelector session={session.data} choice={platformChoice} onChoose={setChoice} />
      {recommendation ? (
        <PlatformRecommendationCard recommendation={recommendation} onSelectId={setSelectedId} />
      ) : null}

      <ArtifactStageCard
        sessionId={sessionId}
        kind="architecture"
        artifact={architecture}
        blockedReason={blockedReason}
        options={platformGenerateOptions(platformChoice, session.data.cloud_platform)}
      />

      {architecture ? (
        <>
          {diagrams.data?.architecture_mermaid ? (
            <SectionCard title="Architecture diagram">
              <DiagramView
                source={diagrams.data.architecture_mermaid}
                title="Solution architecture diagram"
              />
            </SectionCard>
          ) : null}
          <SectionCard
            title="Application components and cloud services"
            description="Grouped into the fourteen architecture areas."
          >
            <ComponentAreas
              components={architecture.content.components}
              onSelectId={setSelectedId}
            />
          </SectionCard>
          <SectionCard title="Security, deployment and operations">
            <ArchitectureSections architecture={architecture.content} onSelectId={setSelectedId} />
          </SectionCard>
          <SectionCard
            title="Requirement traceability"
            description="Which components carry each requirement."
          >
            <ComponentTraceability
              components={architecture.content.components}
              onSelectId={setSelectedId}
            />
          </SectionCard>
        </>
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
