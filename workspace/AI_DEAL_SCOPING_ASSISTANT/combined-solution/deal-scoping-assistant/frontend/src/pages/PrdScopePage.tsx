import { useState } from "react"
import { useParams } from "react-router"
import { artifactOf, useArtifacts } from "@/api/hooks/artifacts"
import { useScope } from "@/api/hooks/scope"
import { useSession } from "@/api/hooks/sessions"
import { CoverageView } from "@/components/prd/CoverageView"
import { EnhancementSection } from "@/components/prd/EnhancementSection"
import { FunctionalScopeView } from "@/components/prd/FunctionalScopeView"
import { OutOfScopeSection } from "@/components/prd/OutOfScopeSection"
import { PrdView } from "@/components/prd/PrdView"
import { ArtifactStageCard } from "@/components/shared/ArtifactStageCard"
import { ErrorState } from "@/components/shared/ErrorState"
import { LoadingState } from "@/components/shared/LoadingState"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"
import { TraceSheet } from "@/components/shared/TraceSheet"

const NEEDS_APPROVAL = "Approve the requirements first; everything below is generated from them."
const NEEDS_PRD = "Generate the PRD first — the functional scope is organised from it."

export default function PrdScopePage() {
  const { sessionId = "" } = useParams<{ sessionId: string }>()
  const session = useSession(sessionId)
  const artifacts = useArtifacts(sessionId)
  const scope = useScope(sessionId)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (session.isPending) return <LoadingState lines={6} label="Loading the workspace" />
  if (session.isError) return <ErrorState error={session.error} onRetry={() => session.refetch()} />

  const approved = session.data.scope_status === "approved"
  const prd = artifactOf(artifacts.data, "prd")
  const functionalScope = artifactOf(artifacts.data, "functional_scope")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Generate the PRD"
        description="Built only from the requirements you approved."
      />
      {artifacts.isError ? (
        <ErrorState error={artifacts.error} onRetry={() => artifacts.refetch()} />
      ) : null}

      <ArtifactStageCard
        sessionId={sessionId}
        kind="prd"
        artifact={prd}
        blockedReason={approved ? null : NEEDS_APPROVAL}
      />
      {prd ? (
        <SectionCard
          title="Product Requirements Document"
          description="Every statement shows its basis and requirement ids."
        >
          <PrdView prd={prd.content} onSelectId={setSelectedId} />
        </SectionCard>
      ) : null}

      <ArtifactStageCard
        sessionId={sessionId}
        kind="functional_scope"
        description="Capabilities, modules, workstreams and delivery packages."
        artifact={functionalScope}
        blockedReason={!approved ? NEEDS_APPROVAL : prd ? null : NEEDS_PRD}
      />
      {functionalScope ? (
        <>
          <SectionCard title="Functional scope">
            <FunctionalScopeView scope={functionalScope.content} onSelectId={setSelectedId} />
          </SectionCard>
          {functionalScope.content.recommended_enhancements.length > 0 ? (
            <SectionCard
              title="Recommended enhancements"
              description="Suggested by the assistant, not requested."
            >
              <EnhancementSection
                enhancements={functionalScope.content.recommended_enhancements}
                onSelectId={setSelectedId}
              />
            </SectionCard>
          ) : null}
          {functionalScope.content.out_of_scope.length > 0 ? (
            <SectionCard title="Scope boundaries">
              <OutOfScopeSection
                items={functionalScope.content.out_of_scope}
                onSelectId={setSelectedId}
                title="Out of scope"
              />
            </SectionCard>
          ) : null}
        </>
      ) : null}

      <CoverageView
        sessionId={sessionId}
        enabled={Boolean(functionalScope)}
        onSelectId={setSelectedId}
      />

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
