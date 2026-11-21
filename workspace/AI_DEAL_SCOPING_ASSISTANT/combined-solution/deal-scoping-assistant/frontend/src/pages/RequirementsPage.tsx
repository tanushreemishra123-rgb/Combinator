import { useState } from "react"
import { useParams } from "react-router"
import { useDocuments } from "@/api/hooks/documents"
import { useScope } from "@/api/hooks/scope"
import { useSession } from "@/api/hooks/sessions"
import { useSystemInfo } from "@/api/hooks/system"
import { AnalysisPanel } from "@/components/requirements/AnalysisPanel"
import { ApproveBar } from "@/components/requirements/ApproveBar"
import { ApprovedNotice } from "@/components/requirements/ApprovedNotice"
import { CustomerInputPanel } from "@/components/requirements/CustomerInputPanel"
import { MockScenarioNotice } from "@/components/requirements/MockScenarioNotice"
import { NormalizedPreview } from "@/components/requirements/NormalizedPreview"
import { ReviewTabs } from "@/components/requirements/ReviewTabs"
import { ScopeItemSheet } from "@/components/requirements/ScopeItemSheet"
import { ScopeReview } from "@/components/requirements/ScopeReview"
import {
  criticalQuestionIds,
  findScopeItem,
  flattenScope,
  itemsOfType,
} from "@/components/requirements/scopeItems"
import { ErrorState } from "@/components/shared/ErrorState"
import { LoadingState } from "@/components/shared/LoadingState"
import { PageHeader } from "@/components/shared/PageHeader"

export default function RequirementsPage() {
  const { sessionId = "" } = useParams<{ sessionId: string }>()
  const session = useSession(sessionId)
  const { data: system } = useSystemInfo()
  const scope = useScope(sessionId)
  const documents = useDocuments(sessionId)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (session.isPending) return <LoadingState lines={6} label="Loading the requirements" />
  if (session.isError) return <ErrorState error={session.error} onRetry={() => session.refetch()} />

  const locked = scope.data?.locked ?? session.data.scope_status === "approved"
  const selected = findScopeItem(scope.data, selectedId)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Understand the customer need"
        description="Bring the customer's words in, review the scope, approve it."
      />
      {locked ? (
        <ApprovedNotice sessionId={sessionId} scopeVersion={session.data.scope_version} />
      ) : null}
      {locked ? null : <MockScenarioNotice system={system} session={session.data} />}

      <CustomerInputPanel
        session={session.data}
        documents={documents.data ?? []}
        documentsError={documents.isError ? documents.error : null}
        itemCount={flattenScope(scope.data).length}
        locked={locked}
      />

      <NormalizedPreview sessionId={sessionId} documents={documents.data ?? []} />

      <AnalysisPanel
        sessionId={sessionId}
        hasDocuments={(documents.data?.length ?? 0) > 0}
        locked={locked}
        replaysSample={system?.ai_mode === "mock" && !session.data.scenario_slug}
        onSelectId={setSelectedId}
      />

      {scope.isError ? <ErrorState error={scope.error} onRetry={() => scope.refetch()} /> : null}

      <ScopeReview
        sessionId={sessionId}
        scope={scope.data}
        locked={locked}
        onSelect={(item) => setSelectedId(item.id)}
      />

      <ReviewTabs
        sessionId={sessionId}
        gaps={itemsOfType(scope.data, "GAP")}
        assumptions={itemsOfType(scope.data, "ASM")}
        questions={itemsOfType(scope.data, "Q")}
        criticalIds={criticalQuestionIds(scope.data)}
        locked={locked}
        onSelectId={setSelectedId}
      />

      <ApproveBar sessionId={sessionId} scope={scope.data} onSelectId={setSelectedId} />

      <ScopeItemSheet
        sessionId={sessionId}
        item={selected}
        scope={scope.data}
        readOnly={locked}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onSelectId={setSelectedId}
      />
    </div>
  )
}
