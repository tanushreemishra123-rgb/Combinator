import { Suspense } from "react"
import { FolderXIcon } from "lucide-react"
import { Link, Outlet, useParams } from "react-router"
import { ApiError } from "@/api/client"
import { useArtifacts } from "@/api/hooks/artifacts"
import { useQualityReport } from "@/api/hooks/quality"
import { useSession } from "@/api/hooks/sessions"
import { useSystemInfo } from "@/api/hooks/system"
import { AiModeNotice } from "@/components/layout/AiModeNotice"
import { AppShell } from "@/components/layout/AppShell"
import { HomeNav } from "@/components/layout/HomeNav"
import { SessionLayout } from "@/components/layout/SessionLayout"
import { deriveStepStatuses } from "@/components/layout/stepStatus"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/shared/LoadingState"
import NotFoundPage from "@/pages/NotFoundPage"

function SessionShell({ sessionId }: { sessionId: string }) {
  const session = useSession(sessionId)
  const artifacts = useArtifacts(sessionId)
  const quality = useQualityReport(sessionId)
  const { data: system } = useSystemInfo()

  if (session.isPending)
    return <LoadingState lines={6} label="Loading the session" className="p-8" />
  if (session.isError) {
    // A deleted or unknown session is a dead end, so offer the way back instead of "try again".
    if (session.error instanceof ApiError && session.error.status === 404) {
      return (
        <AppShell sidebar={<HomeNav />} system={system}>
          <EmptyState
            icon={FolderXIcon}
            title="This session no longer exists"
            description="It was deleted, or the link is old. Your other sessions are still here."
            action={
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/">Back to sessions</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/scenarios">Start from a sample scenario</Link>
                </Button>
              </div>
            }
          />
        </AppShell>
      )
    }
    return (
      <div className="p-8">
        <ErrorState error={session.error} onRetry={() => session.refetch()} />
      </div>
    )
  }

  return (
    <SessionLayout
      sessionId={sessionId}
      customerName={session.data.customer_name}
      scopeVersion={session.data.scope_version}
      scopeStatus={session.data.scope_status}
      statuses={deriveStepStatuses(
        session.data,
        artifacts.data,
        quality.data?.summary.export_status,
      )}
      system={system}
      notice={system ? <AiModeNotice system={system} /> : null}
    >
      <Suspense fallback={<LoadingState lines={6} label="Loading the workspace" />}>
        <Outlet />
      </Suspense>
    </SessionLayout>
  )
}

export default function SessionRoute() {
  const { sessionId } = useParams<{ sessionId: string }>()
  if (!sessionId) return <NotFoundPage />
  return <SessionShell sessionId={sessionId} />
}
