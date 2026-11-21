import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useUpdateSession } from "@/api/hooks/sessions"
import { ErrorState } from "@/components/shared/ErrorState"
import { FormField } from "@/components/shared/FormField"
import { Button } from "@/components/ui/button"
import { FormGrid } from "@/components/shared/FormGrid"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { Session } from "@/api/types"

const schema = z.object({
  customer_name: z.string().trim(),
  opportunity_context: z.string().trim(),
})

type ContextValues = z.infer<typeof schema>

export function ContextForm({ session }: { session: Session }) {
  const update = useUpdateSession(session.id)
  const { register, handleSubmit, formState } = useForm<ContextValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_name: session.customer_name,
      opportunity_context: session.opportunity_context,
    },
  })

  const submit = handleSubmit(async (values) => {
    await update.mutateAsync(values)
  })

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FormGrid columns={2}>
          <FormField id="context-customer" label="Customer name">
            <Input id="context-customer" {...register("customer_name")} />
          </FormField>
          {/* Long text never sits beside a short field: the context takes the full width. */}
          <FormField id="context-opportunity" label="Opportunity context" className="sm:col-span-2">
            <Textarea id="context-opportunity" rows={5} {...register("opportunity_context")} />
          </FormField>
        </FormGrid>
        {update.isError ? <ErrorState error={update.error} /> : null}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="outline" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? <Spinner data-icon="inline-start" /> : null}
            Save context
          </Button>
          {update.isSuccess && !formState.isDirty ? (
            <span className="text-sm text-muted-foreground">Saved.</span>
          ) : null}
        </div>
      </form>
    </>
  )
}
