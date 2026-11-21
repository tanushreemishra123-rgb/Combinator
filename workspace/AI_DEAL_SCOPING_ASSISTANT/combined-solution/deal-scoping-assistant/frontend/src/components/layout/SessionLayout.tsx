import type { ReactNode } from "react"
import { Link } from "react-router"
import { ArrowLeftIcon } from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { SessionSummary } from "@/components/layout/SessionSummary"
import { StepRail } from "@/components/layout/StepRail"
import type { WorkspaceId } from "@/components/layout/steps"
import type { Status } from "@/components/shared/types"
import { Button } from "@/components/ui/button"
import type { ScopeStatus, SystemInfo } from "@/api/types"

interface SessionLayoutProps {
  sessionId: string
  customerName?: string
  scopeVersion?: number
  scopeStatus?: ScopeStatus
  statuses?: ReadonlyMap<WorkspaceId, Status>
  system?: SystemInfo
  notice?: ReactNode
  children: ReactNode
}

/** The app shell with everything about one session in the sidebar. */
export function SessionLayout({
  sessionId,
  customerName,
  scopeVersion,
  scopeStatus,
  statuses,
  system,
  notice,
  children,
}: SessionLayoutProps) {
  return (
    <AppShell
      system={system}
      topbar={
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-mb-2 -ml-2 self-start text-primary hover:bg-primary/10 hover:text-primary"
        >
          <Link to="/">
            <ArrowLeftIcon data-icon="inline-start" />
            All sessions
          </Link>
        </Button>
      }
      notice={notice}
      sidebar={
        <>
          <SessionSummary
            customerName={customerName}
            scopeVersion={scopeVersion}
            scopeStatus={scopeStatus}
          />
          <StepRail sessionId={sessionId} statuses={statuses} />
        </>
      }
    >
      {children}
    </AppShell>
  )
}
