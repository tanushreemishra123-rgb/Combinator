import { QuestionItem } from "@/components/requirements/QuestionItem"
import type { ScopeItem } from "@/api/types"

interface QuestionPanelProps {
  sessionId: string
  questions: readonly ScopeItem[]
  criticalIds: ReadonlySet<string>
  locked: boolean
  onSelectId: (id: string) => void
}

export function QuestionPanel({
  sessionId,
  questions,
  criticalIds,
  locked,
  onSelectId,
}: QuestionPanelProps) {
  return (
    <>
      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No clarification questions were raised.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {questions.map((question) => (
            <QuestionItem
              key={question.id}
              sessionId={sessionId}
              question={question}
              critical={criticalIds.has(question.id)}
              locked={locked}
              onSelectId={onSelectId}
            />
          ))}
        </ul>
      )}
    </>
  )
}
