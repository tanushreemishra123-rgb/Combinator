import { CircleAlertIcon } from "lucide-react"
import { ApiError } from "@/api/client"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const apiError = error instanceof ApiError ? error : undefined
  const title = apiError?.title ?? "Something went wrong"
  const detail = apiError?.detail ?? (error instanceof Error ? error.message : undefined)
  const fieldErrors = apiError?.errors ?? []

  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {detail ? <span>{detail}</span> : null}
        {fieldErrors.length > 0 ? (
          <ul className="flex list-disc flex-col gap-0.5 pl-4">
            {fieldErrors.map((fieldError, index) => (
              <li key={`${fieldError.field ?? ""}-${index}`}>
                {fieldError.field ? `${fieldError.field}: ` : ""}
                {fieldError.message}
              </li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
      {onRetry ? (
        <AlertAction>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </AlertAction>
      ) : null}
    </Alert>
  )
}
