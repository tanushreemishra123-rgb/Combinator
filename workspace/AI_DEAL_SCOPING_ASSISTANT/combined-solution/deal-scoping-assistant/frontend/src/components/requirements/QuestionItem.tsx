import { useState } from "react"
import { cn } from "cn"
import { useAnswerQuestion, useUpdateScopeItem } from "@/api/hooks/scope"
import { IdBadge } from "@/components/shared/IdBadge"
import { IdList } from "@/components/shared/IdList"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { label } from "@/lib/labels"
import { statusTone, toneBadgeVariant } from "@/lib/status"
import type { ScopeItem } from "@/api/types"
import { toQuestionInput } from "@/components/requirements/scopeItemValues"

interface QuestionItemProps {
  sessionId: string
  question: ScopeItem
  critical: boolean
  locked: boolean
  onSelectId: (id: string) => void
}

export function QuestionItem({
  sessionId,
  question,
  critical,
  locked,
  onSelectId,
}: QuestionItemProps) {
  const details = question.details?.question
  const status = details?.answer_status ?? "open"
  const [answer, setAnswer] = useState(details?.answer ?? "")
  const record = useAnswerQuestion(sessionId)
  const update = useUpdateScopeItem(sessionId)

  // There is no dismiss endpoint: dismissing is an edit of the question's answer state.
  const dismiss = () =>
    update.mutate({
      itemId: question.id,
      payload: { details: { question: toQuestionInput(details, { answer_status: "dismissed" }) } },
    })

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3",
        critical && status === "open" && "border-danger/50 bg-danger/5",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <IdBadge id={question.id} onSelect={onSelectId} />
        <Badge variant={toneBadgeVariant(statusTone(status))}>{label(status)}</Badge>
        {critical ? <Badge variant="danger">Critical</Badge> : null}
        <span className="font-medium">{question.title}</span>
      </div>
      {details?.why_it_matters ? (
        <p className="text-sm text-muted-foreground">{details.why_it_matters}</p>
      ) : null}
      <IdList ids={details?.affected_ids ?? []} label="Affects" onSelect={onSelectId} />
      {locked ? (
        details?.answer ? (
          <p className="text-sm">Answer: {details.answer}</p>
        ) : null
      ) : (
        <div className="flex flex-col gap-2">
          <Textarea
            aria-label={`Answer to ${question.id}`}
            rows={2}
            value={answer}
            placeholder="Record what the customer answered"
            onChange={(event) => setAnswer(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!answer.trim() || record.isPending}
              onClick={() => record.mutate({ itemId: question.id, answer })}
            >
              Record answer
            </Button>
            <Button size="sm" variant="ghost" disabled={update.isPending} onClick={dismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
