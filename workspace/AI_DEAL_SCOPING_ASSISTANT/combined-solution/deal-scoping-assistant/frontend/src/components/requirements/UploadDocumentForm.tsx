import { useRef, useState } from "react"
import { useUploadDocument } from "@/api/hooks/documents"
import { ErrorState } from "@/components/shared/ErrorState"
import { FormField } from "@/components/shared/FormField"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_MB, validateUpload } from "@/components/requirements/uploads"

export function UploadDocumentForm({ sessionId }: { sessionId: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const upload = useUploadDocument(sessionId)

  const choose = (chosen: File | null) => {
    setHint(chosen ? validateUpload(chosen) : null)
    setFile(chosen)
  }

  const submit = async () => {
    if (!file || hint) return
    await upload.mutateAsync(file)
    setFile(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="flex flex-col gap-4">
      <FieldGroup>
        <FormField
          id="upload-file"
          label="Requirements file"
          description={`PDF, DOCX, TXT or Markdown, up to ${MAX_UPLOAD_MB} MB. Only the extracted text is stored.`}
          error={hint ? { message: hint } : undefined}
        >
          <Input
            id="upload-file"
            type="file"
            ref={inputRef}
            accept={ACCEPT_ATTRIBUTE}
            aria-invalid={Boolean(hint)}
            onChange={(event) => choose(event.target.files?.[0] ?? null)}
          />
        </FormField>
      </FieldGroup>
      {upload.isError ? <ErrorState error={upload.error} /> : null}
      <div>
        <Button onClick={submit} disabled={!file || Boolean(hint) || upload.isPending}>
          {upload.isPending ? <Spinner data-icon="inline-start" /> : null}
          Upload file
        </Button>
      </div>
    </div>
  )
}
