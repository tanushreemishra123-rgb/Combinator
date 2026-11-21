import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAddPastedDocument } from "@/api/hooks/documents"
import { ErrorState } from "@/components/shared/ErrorState"
import { FormField } from "@/components/shared/FormField"
import { Button } from "@/components/ui/button"
import { FormGrid } from "@/components/shared/FormGrid"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

const schema = z.object({
  name: z.string().trim().min(1, "Name the source, for example “Discovery call notes”."),
  text: z.string().trim().min(1, "Paste the customer text."),
})

type PasteValues = z.infer<typeof schema>

export function PasteDocumentForm({ sessionId }: { sessionId: string }) {
  const addDocument = useAddPastedDocument(sessionId)
  const { register, handleSubmit, formState, reset } = useForm<PasteValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", text: "" },
  })

  const submit = handleSubmit(async (values) => {
    await addDocument.mutateAsync(values)
    reset()
  })

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FormGrid columns={2}>
        <FormField id="paste-name" label="Source name" required error={formState.errors.name}>
          <Input
            id="paste-name"
            aria-invalid={Boolean(formState.errors.name)}
            placeholder="RFP section 2 — requirements"
            {...register("name")}
          />
        </FormField>
        <FormField
          id="paste-text"
          label="Customer text"
          required
          error={formState.errors.text}
          className="sm:col-span-2"
        >
          <Textarea
            id="paste-text"
            rows={10}
            aria-invalid={Boolean(formState.errors.text)}
            {...register("text")}
          />
        </FormField>
      </FormGrid>
      {addDocument.isError ? <ErrorState error={addDocument.error} /> : null}
      <div>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Spinner data-icon="inline-start" /> : null}
          Add this text
        </Button>
      </div>
    </form>
  )
}
