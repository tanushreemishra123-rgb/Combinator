import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import {
  ITEM_STATUSES,
  ITEM_TYPES,
  ORIGINS,
  PRIORITIES,
} from "@/components/requirements/scopeItems"
import { FormField } from "@/components/shared/FormField"
import { SelectField } from "@/components/shared/SelectField"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { itemTypePlural, label } from "@/lib/labels"
import { NEEDS_ITEM_ID } from "@/components/package/changeKinds"
import type { ChangeFormValues, ChangeKind } from "@/components/package/changeKinds"
import type { RateCard } from "@/api/types"

const PLATFORMS = ["aws", "azure", "gcp"] as const
const SECURITY = ["standard", "elevated", "regulated"] as const
const COMPLEXITIES = ["low", "medium", "high", "very_high"] as const
const PROVIDERS = [
  "unset",
  "platform_native",
  "openai",
  "anthropic",
  "google",
  "open_source",
  "none",
] as const
const DECISIONS = ["confirm", "reject"] as const

interface ChangeFieldsProps {
  kind: ChangeKind
  form: UseFormReturn<ChangeFormValues>
  rateCards: readonly RateCard[]
}

/** Only the inputs the chosen change actually needs. */
export function ChangeFields({ kind, form, rateCards }: ChangeFieldsProps) {
  const { register, control } = form
  const select = <K extends keyof ChangeFormValues>(
    name: K,
    id: string,
    text: string,
    options: readonly string[],
    format?: (value: string) => string,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <SelectField
          id={id}
          label={text}
          value={String(field.value)}
          options={options}
          format={format}
          onChange={field.onChange}
        />
      )}
    />
  )

  return (
    <>
      {NEEDS_ITEM_ID.includes(kind) ? (
        <FormField
          id="change-item"
          label="Scope item id"
          required
          error={form.formState.errors.itemId}
        >
          <Input id="change-item" placeholder="FR_01" {...register("itemId")} />
        </FormField>
      ) : null}
      {kind === "requirement_added" ? (
        <>
          {select("newItemType", "change-new-type", "Type", ITEM_TYPES, itemTypePlural)}
          {select("newItemOrigin", "change-new-origin", "Origin", ORIGINS)}
        </>
      ) : null}
      {kind === "requirement_edit" || kind === "requirement_added" ? (
        <>
          <FormField
            id="change-title"
            label="Title"
            required
            error={form.formState.errors.title}
            className="sm:col-span-2"
          >
            <Input id="change-title" {...register("title")} />
          </FormField>
          <FormField id="change-description" label="Description" className="sm:col-span-2">
            <Textarea id="change-description" rows={3} {...register("description")} />
          </FormField>
        </>
      ) : null}
      {kind === "requirement_priority" || kind === "requirement_added"
        ? select("priority", "change-priority", "Priority", PRIORITIES)
        : null}
      {kind === "requirement_status"
        ? select("status", "change-status", "New status", ITEM_STATUSES)
        : null}
      {kind === "assumption_decision"
        ? select("decision", "change-decision", "Decision", DECISIONS, (value) =>
            value === "confirm" ? "Confirm the assumption" : "Reject the assumption",
          )
        : null}
      {kind === "question_answered" ? (
        <FormField
          id="change-answer"
          label="Recorded answer"
          error={form.formState.errors.answer}
          className="sm:col-span-2"
        >
          <Textarea id="change-answer" rows={3} {...register("answer")} />
        </FormField>
      ) : null}
      {kind === "cloud_platform"
        ? select("platform", "change-platform", "New cloud platform", PLATFORMS, label)
        : null}
      {kind === "expected_users" ? (
        <FormField
          id="change-users"
          label="Expected users"
          description="Leave empty if the customer has not said."
          error={form.formState.errors.expectedUsers}
        >
          <Input
            id="change-users"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            {...register("expectedUsers")}
          />
        </FormField>
      ) : null}
      {kind === "delivery_deadline" ? (
        <FormField id="change-deadline" label="Delivery deadline">
          <Input id="change-deadline" type="date" {...register("deadline")} />
        </FormField>
      ) : null}
      {kind === "rate_card"
        ? select(
            "rateCardId",
            "change-rate-card",
            "Rate card",
            rateCards.map((card) => card.id),
            (id) => rateCards.find((card) => card.id === id)?.name ?? id,
          )
        : null}
      {kind === "contingency" ? (
        <FormField
          id="change-contingency"
          label="Contingency (%)"
          required
          error={form.formState.errors.contingency}
        >
          <Input
            id="change-contingency"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            {...register("contingency")}
          />
        </FormField>
      ) : null}
      {kind === "security_level"
        ? select("securityLevel", "change-security", "Security level", SECURITY)
        : null}
      {kind === "regulatory_constraints" ? (
        <FormField
          id="change-regulatory"
          label="Regulatory constraints"
          description="Comma separated."
          className="sm:col-span-2"
        >
          <Input id="change-regulatory" {...register("regulatory")} />
        </FormField>
      ) : null}
      {kind === "ai_provider"
        ? select(
            "aiProvider",
            "change-ai-provider",
            "AI provider preference",
            PROVIDERS,
            (value) => (value === "unset" ? "No preference" : label(value)),
          )
        : null}
      {kind === "unit_complexity" ? (
        <>
          <FormField id="change-unit" label="Unit id" required error={form.formState.errors.unitId}>
            <Input id="change-unit" placeholder="CAP_01" {...register("unitId")} />
          </FormField>
          {select("complexity", "change-complexity", "New complexity", COMPLEXITIES)}
        </>
      ) : null}
    </>
  )
}
