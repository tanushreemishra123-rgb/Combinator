import type { UseFormReturn } from "react-hook-form"
import { FormField } from "@/components/shared/FormField"
import { FormGrid } from "@/components/shared/FormGrid"
import { FormSection } from "@/components/shared/FormSection"
import { Input } from "@/components/ui/input"
import type { EstimationConfigValues } from "@/components/estimate/estimationConfigValues"
import { TeamSizeRows } from "@/components/estimate/TeamSizeRows"
import type { TeamSizeEntry } from "@/api/types"

interface TeamSectionProps {
  form: UseFormReturn<EstimationConfigValues>
  teamSizes: readonly TeamSizeEntry[]
}

export function TeamSection({ form, teamSizes }: TeamSectionProps) {
  const { register, formState } = form
  return (
    <FormSection title="Team">
      <FormGrid columns={3}>
        <FormField
          id="config-productivity"
          label="Productivity factor"
          description="1.0 = one productive person-week per person-week."
          error={formState.errors.productivity_factor}
        >
          <Input
            id="config-productivity"
            type="number"
            inputMode="decimal"
            min={0.1}
            max={2}
            step={0.1}
            aria-invalid={Boolean(formState.errors.productivity_factor)}
            {...register("productivity_factor")}
          />
        </FormField>
        <FormField
          id="config-weeks"
          label="Working weeks per month"
          error={formState.errors.working_weeks_per_month}
        >
          <Input
            id="config-weeks"
            type="number"
            inputMode="decimal"
            min={1}
            max={5}
            step={0.1}
            aria-invalid={Boolean(formState.errors.working_weeks_per_month)}
            {...register("working_weeks_per_month")}
          />
        </FormField>
      </FormGrid>
      <TeamSizeRows form={form} teamSizes={teamSizes} />
    </FormSection>
  )
}
