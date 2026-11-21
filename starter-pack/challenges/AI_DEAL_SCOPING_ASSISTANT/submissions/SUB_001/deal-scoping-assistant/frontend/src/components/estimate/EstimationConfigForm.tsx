import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRecordChange } from "@/api/hooks/changes"
import { useSaveEstimationConfig } from "@/api/hooks/estimate"
import { CommercialsSection } from "@/components/estimate/config/CommercialsSection"
import { CustomerContextSection } from "@/components/estimate/config/CustomerContextSection"
import { DeliverySection } from "@/components/estimate/config/DeliverySection"
import { TeamSection } from "@/components/estimate/config/TeamSection"
import {
  estimationConfigSchema,
  toFormValues,
  toSessionConfig,
} from "@/components/estimate/estimationConfigValues"
import type { EstimationConfigValues } from "@/components/estimate/estimationConfigValues"
import { configChangeRequest, editRoute } from "@/components/estimate/routing"
import { ErrorState } from "@/components/shared/ErrorState"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { RateCard, ScopeStatus, SessionConfig, TeamSizeEntry } from "@/api/types"

interface EstimationConfigFormProps {
  sessionId: string
  config: SessionConfig
  rateCards: readonly RateCard[]
  /** Rule defaults with this session's overrides, so every workstream type has a row. */
  teamSizes: readonly TeamSizeEntry[]
  scopeStatus: ScopeStatus
}

export function EstimationConfigForm({
  sessionId,
  config,
  rateCards,
  teamSizes,
  scopeStatus,
}: EstimationConfigFormProps) {
  const save = useSaveEstimationConfig(sessionId)
  const recordChange = useRecordChange(sessionId)
  const route = editRoute(scopeStatus)
  const savedCard = rateCards.find((card) => card.id === config.rate_card_id)
  const form = useForm<EstimationConfigValues>({
    resolver: zodResolver(estimationConfigSchema),
    values: toFormValues(config, savedCard, teamSizes),
  })
  const { control, formState } = form

  const rateCardId = useWatch({ control, name: "rate_card_id" })
  const selectedCard = rateCards.find((card) => card.id === rateCardId)

  const submit = form.handleSubmit(async (values) => {
    const next = toSessionConfig(values, config, selectedCard)
    if (route === "direct") await save.mutateAsync(next)
    else await recordChange.mutateAsync(configChangeRequest(next))
  })

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <CommercialsSection form={form} rateCards={rateCards} selectedCard={selectedCard} />
      <DeliverySection form={form} />
      <CustomerContextSection form={form} />
      <TeamSection form={form} teamSizes={teamSizes} />

      {save.isError ? <ErrorState error={save.error} /> : null}
      {recordChange.isError ? <ErrorState error={recordChange.error} /> : null}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t bg-card px-4 py-3 sm:-mx-6 sm:px-6">
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Spinner data-icon="inline-start" /> : null}
          Save inputs
        </Button>
        {formState.isDirty ? (
          <span className="text-sm text-muted-foreground">Unsaved changes</span>
        ) : null}
        {route === "change_request" ? (
          <span className="text-sm text-muted-foreground">
            Saving records a configuration change with its impact.
          </span>
        ) : null}
      </div>
    </form>
  )
}
