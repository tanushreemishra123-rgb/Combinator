import { LockIcon } from "lucide-react"
import { Link } from "react-router"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

/** After approval the backend answers 409 to direct edits, so the UI points at the right route. */
export function ApprovedNotice({
  sessionId,
  scopeVersion,
}: {
  sessionId: string
  scopeVersion: number
}) {
  return (
    <Alert>
      <LockIcon />
      <AlertTitle>Scope version {scopeVersion} is approved</AlertTitle>
      <AlertDescription>
        This workspace is read-only now. Further changes are made in “Review change impact”, so the
        affected deliverables are recorded and regenerated with them.
      </AlertDescription>
      <AlertAction>
        <Button asChild variant="outline" size="sm">
          <Link to={`/sessions/${sessionId}/package`}>Review change impact</Link>
        </Button>
      </AlertAction>
    </Alert>
  )
}
