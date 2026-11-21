import { useState } from "react"
import { useChanges } from "@/api/hooks/changes"
import { ChangeForm } from "@/components/package/ChangeForm"
import { ChangeHistory } from "@/components/package/ChangeHistory"
import { ChangeRecordView } from "@/components/package/ChangeRecordView"
import { ErrorState } from "@/components/shared/ErrorState"
import { SectionCard } from "@/components/shared/SectionCard"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { ChangeRecord, RateCard, Session } from "@/api/types"

interface ChangePanelProps {
  session: Session
  rateCards: readonly RateCard[]
  onSelectId?: (id: string) => void
}

export function ChangePanel({ session, rateCards, onSelectId }: ChangePanelProps) {
  const changes = useChanges(session.id)
  const [shown, setShown] = useState<ChangeRecord | null>(null)
  const approved = session.scope_status === "approved"

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Review change impact"
        description="Change one input and see what it moves."
      >
        {approved ? (
          <ChangeForm
            sessionId={session.id}
            config={session.config}
            rateCards={rateCards}
            onRecorded={setShown}
          />
        ) : (
          <Alert>
            <AlertDescription>
              Change tracking starts after the first scope approval. Until then the requirements
              workspace edits the scope directly.
            </AlertDescription>
          </Alert>
        )}
      </SectionCard>

      {shown ? (
        <ChangeRecordView sessionId={session.id} record={shown} onSelectId={onSelectId} />
      ) : null}

      <SectionCard title="Change history">
        {changes.isError ? (
          <ErrorState error={changes.error} onRetry={() => changes.refetch()} />
        ) : (
          <ChangeHistory changes={changes.data ?? []} onOpen={setShown} />
        )}
      </SectionCard>
    </div>
  )
}
