import { CompassIcon } from "lucide-react"
import { Link } from "react-router"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={CompassIcon}
      title="Page not found"
      description="That page does not exist in this workspace."
      action={
        <Button asChild variant="outline">
          <Link to="/">Back to sessions</Link>
        </Button>
      }
    />
  )
}
