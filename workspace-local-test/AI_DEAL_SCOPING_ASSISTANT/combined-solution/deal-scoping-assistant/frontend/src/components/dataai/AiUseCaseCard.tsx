import { ProcessingClassBadge } from "@/components/dataai/ProcessingClassBadge"
import { BasisBadge } from "@/components/shared/BasisBadge"
import { IdBadge } from "@/components/shared/IdBadge"
import { IdList } from "@/components/shared/IdList"
import { KeyValueList } from "@/components/shared/KeyValueList"
import type { KeyValueItem } from "@/components/shared/KeyValueList"
import { ValidationBadge } from "@/components/shared/ValidationBadge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AiUseCase } from "@/api/types"

interface AiUseCaseCardProps {
  useCase: AiUseCase
  onSelectId?: (id: string) => void
}

export function AiUseCaseCard({ useCase, onSelectId }: AiUseCaseCardProps) {
  const rows: KeyValueItem[] = [
    { label: "Pattern", value: useCase.pattern },
    {
      label: "Model options",
      value: useCase.model_options.length ? useCase.model_options.join(", ") : "Not stated",
    },
    {
      label: "Retrieval",
      value: useCase.retrieval_required ? useCase.retrieval_notes || "Required" : "Not required",
    },
    { label: "Orchestration", value: useCase.orchestration || "Not stated" },
    { label: "Prompt and output", value: useCase.prompt_and_structured_output || "Not stated" },
    { label: "Evaluation", value: useCase.evaluation || "Not stated" },
    { label: "Responsible AI and safety", value: useCase.responsible_ai_safety || "Not stated" },
    { label: "Monitoring and feedback", value: useCase.monitoring_feedback || "Not stated" },
    { label: "Human review", value: useCase.human_review || "Not stated" },
    { label: "Data privacy", value: useCase.data_privacy || "Not stated" },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <IdBadge id={useCase.id} />
          {useCase.name}
        </CardTitle>
        <CardDescription>{useCase.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ProcessingClassBadge processing={useCase.processing_class} />
          <BasisBadge basis={useCase.basis} />
          {useCase.validation_required ? (
            <ValidationBadge reason={useCase.validation_reason} />
          ) : null}
        </div>
        <IdList ids={useCase.req_ids} label={`${useCase.id} requirements`} onSelect={onSelectId} />
        <KeyValueList items={rows} />
      </CardContent>
    </Card>
  )
}
