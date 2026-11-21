import { Controller } from "react-hook-form"
import type { ReactNode } from "react"
import type { UseFormReturn } from "react-hook-form"
import { FormField } from "@/components/shared/FormField"
import { FormGrid } from "@/components/shared/FormGrid"
import { SelectField } from "@/components/shared/SelectField"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ITEM_STATUSES, ORIGINS, PRIORITIES } from "@/components/requirements/scopeItems"
import type { ScopeItemFormValues } from "@/components/requirements/scopeItemValues"
import type { ItemType } from "@/api/types"

const NFR_CATEGORIES = [
  "performance",
  "scalability",
  "availability",
  "security",
  "compliance",
  "usability",
  "maintainability",
  "observability",
] as const
const DIRECTIONS = ["inbound", "outbound", "bidirectional"] as const
const PATTERNS = ["api", "event", "batch", "file"] as const
const CRITICALITIES = ["high", "medium", "low"] as const

interface ScopeItemFieldsProps {
  form: UseFormReturn<ScopeItemFormValues>
  type: ItemType
  idPrefix: string
  /** The create dialog has no status yet; the item is always proposed. */
  showStatus?: boolean
  /** Rendered as the first cell of the classification row. */
  typeSelect?: ReactNode
}

export function ScopeItemFields({
  form,
  type,
  idPrefix,
  showStatus = true,
  typeSelect,
}: ScopeItemFieldsProps) {
  const { register, control, formState } = form

  return (
    <div className="flex flex-col gap-4">
      <FormGrid columns={3}>
        {typeSelect}
        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <SelectField
              id={`${idPrefix}-priority`}
              label="Priority"
              value={field.value}
              options={PRIORITIES}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="origin"
          render={({ field }) => (
            <SelectField
              id={`${idPrefix}-origin`}
              label="Origin"
              value={field.value}
              options={ORIGINS}
              onChange={field.onChange}
            />
          )}
        />
        {showStatus ? (
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SelectField
                id={`${idPrefix}-status`}
                label="Review status"
                value={field.value}
                options={ITEM_STATUSES}
                onChange={field.onChange}
              />
            )}
          />
        ) : null}
      </FormGrid>

      <FormField id={`${idPrefix}-title`} label="Title" required error={formState.errors.title}>
        <Input
          id={`${idPrefix}-title`}
          aria-invalid={Boolean(formState.errors.title)}
          {...register("title")}
        />
      </FormField>
      <FormField id={`${idPrefix}-description`} label="Description">
        <Textarea id={`${idPrefix}-description`} rows={4} {...register("description")} />
      </FormField>

      <FormGrid columns={2}>
        {type === "NFR" ? (
          <Controller
            control={control}
            name="nfr_category"
            render={({ field }) => (
              <SelectField
                id={`${idPrefix}-nfr-category`}
                label="Category"
                value={field.value}
                options={NFR_CATEGORIES}
                onChange={field.onChange}
              />
            )}
          />
        ) : null}
        {type === "INT" ? (
          <>
            <FormField id={`${idPrefix}-int-system`} label="System">
              <Input id={`${idPrefix}-int-system`} {...register("integration_system")} />
            </FormField>
            <Controller
              control={control}
              name="integration_direction"
              render={({ field }) => (
                <SelectField
                  id={`${idPrefix}-int-direction`}
                  label="Direction"
                  value={field.value}
                  options={DIRECTIONS}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="integration_pattern"
              render={({ field }) => (
                <SelectField
                  id={`${idPrefix}-int-pattern`}
                  label="Pattern"
                  value={field.value}
                  options={PATTERNS}
                  onChange={field.onChange}
                />
              )}
            />
          </>
        ) : null}
        {type === "GAP" ? (
          <Controller
            control={control}
            name="gap_criticality"
            render={({ field }) => (
              <SelectField
                id={`${idPrefix}-gap-criticality`}
                label="Criticality"
                value={field.value}
                options={CRITICALITIES}
                onChange={field.onChange}
              />
            )}
          />
        ) : null}
        {type === "ASM" ? (
          <FormField
            id={`${idPrefix}-asm-impact`}
            label="Impact if the assumption is wrong"
            className="sm:col-span-2"
          >
            <Textarea id={`${idPrefix}-asm-impact`} rows={3} {...register("assumption_impact")} />
          </FormField>
        ) : null}
        {type === "Q" ? (
          <FormField
            id={`${idPrefix}-q-why`}
            label="Why the answer matters"
            className="sm:col-span-2"
          >
            <Textarea id={`${idPrefix}-q-why`} rows={3} {...register("question_why")} />
          </FormField>
        ) : null}
      </FormGrid>

      <FormField id={`${idPrefix}-notes`} label="Reviewer notes">
        <Textarea id={`${idPrefix}-notes`} rows={2} {...register("notes")} />
      </FormField>
    </div>
  )
}
