import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useUpdateScopeItem } from "@/api/hooks/scope"
import { ScopeItemFields } from "@/components/requirements/ScopeItemFields"
import {
  scopeItemSchema,
  toFormValues,
  toUpdatePayload,
} from "@/components/requirements/scopeItemValues"
import type { ScopeItemFormValues } from "@/components/requirements/scopeItemValues"
import { ErrorState } from "@/components/shared/ErrorState"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { ScopeItem } from "@/api/types"

interface ScopeItemFormProps {
  sessionId: string
  item: ScopeItem
  onDone: () => void
}

export function ScopeItemForm({ sessionId, item, onDone }: ScopeItemFormProps) {
  const update = useUpdateScopeItem(sessionId)
  const form = useForm<ScopeItemFormValues>({
    resolver: zodResolver(scopeItemSchema),
    defaultValues: toFormValues(item),
  })

  const submit = form.handleSubmit(async (values) => {
    await update.mutateAsync({ itemId: item.id, payload: toUpdatePayload(values, item) })
    onDone()
  })

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <ScopeItemFields form={form} type={item.type} idPrefix={`edit-${item.id}`} />
      {update.isError ? <ErrorState error={update.error} /> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner data-icon="inline-start" /> : null}
          Save changes
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
