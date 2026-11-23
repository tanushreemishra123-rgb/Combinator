import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate } from "react-router"
import { z } from "zod"
import { PlusIcon } from "lucide-react"
import { useCreateSession } from "@/api/hooks/sessions"
import { ErrorState } from "@/components/shared/ErrorState"
import { FormField } from "@/components/shared/FormField"
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
import { FormGrid } from "@/components/shared/FormGrid"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

const schema = z.object({
  name: z.string().trim().min(1, "Give the session a name."),
  customer_name: z.string().trim(),
  opportunity_context: z.string().trim(),
})

type NewSessionValues = z.infer<typeof schema>

export function NewSessionDialog() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const createSession = useCreateSession()
  const { register, handleSubmit, formState, reset } = useForm<NewSessionValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", customer_name: "", opportunity_context: "" },
  })

  const submit = handleSubmit(async (values) => {
    const session = await createSession.mutateAsync({ ...values, platform_mode: "selected" })
    setOpen(false)
    reset()
    await navigate(`/sessions/${session.id}/requirements`)
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          New session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New scoping session</DialogTitle>
          <DialogDescription>
            Start from the customer you are scoping for. You can add the requirements next.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <FormGrid columns={2}>
            <FormField
              id="session-name"
              label="Session name"
              required
              error={formState.errors.name}
            >
              <Input
                id="session-name"
                aria-invalid={Boolean(formState.errors.name)}
                placeholder="Policy platform modernization"
                {...register("name")}
              />
            </FormField>
            <FormField id="session-customer" label="Customer name">
              <Input
                id="session-customer"
                placeholder="Northwind Insurance"
                {...register("customer_name")}
              />
            </FormField>
            <FormField id="session-context" label="Opportunity context" className="sm:col-span-2">
              <Textarea id="session-context" rows={4} {...register("opportunity_context")} />
            </FormField>
          </FormGrid>
          {createSession.isError ? <ErrorState error={createSession.error} /> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              Create session
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
