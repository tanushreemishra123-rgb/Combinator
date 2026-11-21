import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon } from "lucide-react"
import { useCreateScopeItem } from "@/api/hooks/scope"
import { ScopeItemFields } from "@/components/requirements/ScopeItemFields"
import { ITEM_TYPES } from "@/components/requirements/scopeItems"
import {
  scopeItemSchema,
  toCreatePayload,
  toFormValues,
} from "@/components/requirements/scopeItemValues"
import type { ScopeItemFormValues } from "@/components/requirements/scopeItemValues"
import { ErrorState } from "@/components/shared/ErrorState"
import { SelectField } from "@/components/shared/SelectField"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { itemTypePlural } from "@/lib/labels"
import type { ItemType } from "@/api/types"

export function AddScopeItemDialog({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<ItemType>("FR")
  const create = useCreateScopeItem(sessionId)
  const form = useForm<ScopeItemFormValues>({
    resolver: zodResolver(scopeItemSchema),
    defaultValues: toFormValues(),
  })

  const submit = form.handleSubmit(async (values) => {
    await create.mutateAsync(toCreatePayload(values, type))
    form.reset(toFormValues())
    setOpen(false)
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusIcon data-icon="inline-start" />
          Add item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a scope item</DialogTitle>
          <DialogDescription>
            Record something the analysis missed. It is marked as added by you.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <ScopeItemFields
            form={form}
            type={type}
            idPrefix="add"
            showStatus={false}
            typeSelect={
              <SelectField<ItemType>
                id="add-item-type"
                label="Type"
                required
                value={type}
                options={ITEM_TYPES}
                format={itemTypePlural}
                onChange={setType}
              />
            }
          />
          {create.isError ? <ErrorState error={create.error} /> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              Add item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
