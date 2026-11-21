import { useState } from "react"
import { useForm } from "react-hook-form"
import { useRecordChange } from "@/api/hooks/changes"
import { ChangeFields } from "@/components/package/ChangeFields"
import {
  CHANGE_KINDS,
  buildChangeRequest,
  changeKindLabel,
  validateChangeValues,
} from "@/components/package/changeKinds"
import type { ChangeFormValues, ChangeKind } from "@/components/package/changeKinds"
import { ErrorState } from "@/components/shared/ErrorState"
import { FormField } from "@/components/shared/FormField"
import { FormGrid } from "@/components/shared/FormGrid"
import { SelectField } from "@/components/shared/SelectField"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import type { ChangeRecord, RateCard, SessionConfig } from "@/api/types"

const EMPTY: ChangeFormValues = {
  note: "",
  itemId: "",
  title: "",
  description: "",
  priority: "high",
  status: "approved",
  newItemType: "FR",
  newItemOrigin: "customer_stated",
  decision: "confirm",
  answer: "",
  platform: "aws",
  expectedUsers: "",
  deadline: "",
  rateCardId: "",
  contingency: "",
  securityLevel: "standard",
  regulatory: "",
  aiProvider: "unset",
  unitId: "",
  complexity: "medium",
}

interface ChangeFormProps {
  sessionId: string
  config: SessionConfig
  rateCards: readonly RateCard[]
  onRecorded: (record: ChangeRecord) => void
}

export function ChangeForm({ sessionId, config, rateCards, onRecorded }: ChangeFormProps) {
  const [kind, setKind] = useState<ChangeKind>("requirement_priority")
  const record = useRecordChange(sessionId)
  const form = useForm<ChangeFormValues>({
    defaultValues: { ...EMPTY, rateCardId: config.rate_card_id },
    // The rules depend on the kind, which lives outside the form values.
    resolver: (values) => {
      const errors = validateChangeValues(kind, values)
      return {
        values: Object.keys(errors).length ? {} : values,
        errors: Object.fromEntries(
          Object.entries(errors).map(([field, message]) => [field, { type: "validate", message }]),
        ),
      }
    },
  })

  const submit = form.handleSubmit(async (values) => {
    onRecorded(await record.mutateAsync(buildChangeRequest(kind, values, config)))
  })

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <SelectField<ChangeKind>
        id="change-kind"
        label="What is changing?"
        value={kind}
        options={CHANGE_KINDS}
        format={changeKindLabel}
        onChange={setKind}
      />
      <FormGrid columns={2}>
        <ChangeFields kind={kind} form={form} rateCards={rateCards} />
      </FormGrid>
      <FormField id="change-note" label="Why the change">
        <Input id="change-note" {...form.register("note")} />
      </FormField>
      {record.isError ? <ErrorState error={record.error} /> : null}
      <div>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner data-icon="inline-start" /> : null}
          Record the change
        </Button>
      </div>
    </form>
  )
}
