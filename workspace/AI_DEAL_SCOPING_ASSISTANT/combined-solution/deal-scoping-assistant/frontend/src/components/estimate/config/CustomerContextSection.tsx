import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { FormField } from "@/components/shared/FormField"
import { FormGrid } from "@/components/shared/FormGrid"
import { FormSection } from "@/components/shared/FormSection"
import { SelectField } from "@/components/shared/SelectField"
import { Input } from "@/components/ui/input"
import type { EstimationConfigValues } from "@/components/estimate/estimationConfigValues"
import { NO_PREFERENCE } from "@/components/estimate/estimationConfigValues"
import { label } from "@/lib/labels"

const PROVIDERS = [
  NO_PREFERENCE,
  "platform_native",
  "openai",
  "anthropic",
  "google",
  "open_source",
  "none",
] as const

interface CustomerContextSectionProps {
  form: UseFormReturn<EstimationConfigValues>
}

export function CustomerContextSection({ form }: CustomerContextSectionProps) {
  const { register, control, formState } = form
  return (
    <FormSection title="Customer context">
      <FormGrid columns={3}>
        <FormField
          id="config-users"
          label="Expected users"
          description="Leave empty if the customer has not said."
          error={formState.errors.expected_users}
        >
          <Input
            id="config-users"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            aria-invalid={Boolean(formState.errors.expected_users)}
            {...register("expected_users")}
          />
        </FormField>
        <FormField id="config-deadline" label="Delivery date">
          <Input id="config-deadline" type="date" {...register("delivery_deadline")} />
        </FormField>
        <Controller
          control={control}
          name="ai_provider_preference"
          render={({ field }) => (
            <SelectField
              id="config-ai-provider"
              label="AI provider"
              value={field.value}
              options={PROVIDERS}
              format={(value) => (value === NO_PREFERENCE ? "No preference" : label(value))}
              onChange={field.onChange}
            />
          )}
        />
        <FormField
          id="config-regions"
          label="Target regions"
          description="Comma separated."
          className="sm:col-span-2"
        >
          <Input id="config-regions" {...register("target_regions")} />
        </FormField>
        <FormField
          id="config-regulatory"
          label="Regulatory constraints"
          description="Comma separated."
          className="sm:col-span-2"
        >
          <Input id="config-regulatory" {...register("regulatory_constraints")} />
        </FormField>
      </FormGrid>
    </FormSection>
  )
}
