import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { FormField } from "@/components/shared/FormField"
import { FormGrid } from "@/components/shared/FormGrid"
import { FormSection } from "@/components/shared/FormSection"
import { SelectField } from "@/components/shared/SelectField"
import { Input } from "@/components/ui/input"
import type { EstimationConfigValues } from "@/components/estimate/estimationConfigValues"

const SECURITY = ["standard", "elevated", "regulated"] as const
const TESTING = ["standard", "extended"] as const
const MIGRATION = ["none", "light", "heavy"] as const

interface DeliverySectionProps {
  form: UseFormReturn<EstimationConfigValues>
}

export function DeliverySection({ form }: DeliverySectionProps) {
  const { register, control, formState } = form
  return (
    <FormSection title="Delivery">
      <FormGrid columns={4}>
        <Controller
          control={control}
          name="security_level"
          render={({ field }) => (
            <SelectField
              id="config-security"
              label="Security level"
              value={field.value}
              options={SECURITY}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="testing_level"
          render={({ field }) => (
            <SelectField
              id="config-testing"
              label="Testing level"
              value={field.value}
              options={TESTING}
              onChange={field.onChange}
            />
          )}
        />
        <FormField
          id="config-environments"
          label="Environments"
          error={formState.errors.environments_count}
        >
          <Input
            id="config-environments"
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            step={1}
            aria-invalid={Boolean(formState.errors.environments_count)}
            {...register("environments_count")}
          />
        </FormField>
        <Controller
          control={control}
          name="data_migration"
          render={({ field }) => (
            <SelectField
              id="config-migration"
              label="Data migration"
              value={field.value}
              options={MIGRATION}
              onChange={field.onChange}
            />
          )}
        />
      </FormGrid>
    </FormSection>
  )
}
