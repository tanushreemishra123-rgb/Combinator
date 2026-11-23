import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { FormField } from "@/components/shared/FormField"
import { FormGrid } from "@/components/shared/FormGrid"
import { FormSection } from "@/components/shared/FormSection"
import { SelectField } from "@/components/shared/SelectField"
import { Input } from "@/components/ui/input"
import { roleRateRows } from "@/components/estimate/estimationConfigValues"
import type { EstimationConfigValues } from "@/components/estimate/estimationConfigValues"
import { RoleRateRows } from "@/components/estimate/RoleRateRows"
import type { RateCard } from "@/api/types"

interface CommercialsSectionProps {
  form: UseFormReturn<EstimationConfigValues>
  rateCards: readonly RateCard[]
  selectedCard: RateCard | undefined
}

export function CommercialsSection({ form, rateCards, selectedCard }: CommercialsSectionProps) {
  const { register, control, formState } = form
  const currency = selectedCard?.currency

  // A different card has different roles, so its rows replace the edited ones.
  function chooseCard(id: string, onChange: (value: string) => void) {
    onChange(id)
    const card = rateCards.find((entry) => entry.id === id)
    form.setValue("role_rates", roleRateRows(card, []), { shouldDirty: true })
  }
  return (
    <FormSection title="Commercials">
      <FormGrid columns={2}>
        <Controller
          control={control}
          name="rate_card_id"
          render={({ field }) => (
            <SelectField
              id="config-rate-card"
              label="Rate card"
              description={currency ? `Quoted in ${currency}.` : undefined}
              placeholder="Choose a rate card"
              required
              value={field.value}
              options={rateCards.map((card) => card.id)}
              format={(id) => rateCards.find((card) => card.id === id)?.name ?? id}
              onChange={(id) => chooseCard(id, field.onChange)}
              disabledReason={rateCards.length === 0 ? "Rate cards are still loading." : undefined}
            />
          )}
        />
        <FormField
          id="config-contingency"
          label="Contingency (%)"
          required
          error={formState.errors.contingency_pct}
        >
          <Input
            id="config-contingency"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            aria-invalid={Boolean(formState.errors.contingency_pct)}
            {...register("contingency_pct")}
          />
        </FormField>
      </FormGrid>
      <RoleRateRows form={form} card={selectedCard} />
    </FormSection>
  )
}
