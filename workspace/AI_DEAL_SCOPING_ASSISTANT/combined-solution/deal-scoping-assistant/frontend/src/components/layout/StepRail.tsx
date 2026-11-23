import { CheckIcon } from "lucide-react"
import { NavLink } from "react-router"
import { cn } from "cn"
import { WORKSPACE_STEPS } from "@/components/layout/steps"
import type { WorkspaceId } from "@/components/layout/steps"
import type { Status } from "@/components/shared/types"
import { label } from "@/lib/labels"
import { statusTone, toneMarkerClass } from "@/lib/status"

interface StepRailProps {
  sessionId: string
  statuses?: ReadonlyMap<WorkspaceId, Status>
}

function StepMarker({ index, status, active }: { index: number; status: Status; active: boolean }) {
  const done = status === "done" || status === "approved"
  return (
    <span
      role="img"
      aria-label={`Status: ${label(status)}`}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] tabular-nums",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : toneMarkerClass(statusTone(status)),
      )}
    >
      {done ? <CheckIcon className="size-3" aria-hidden /> : index + 1}
    </span>
  )
}

/** Vertical rail in the sidebar, horizontally scrolling step strip below md. */
export function StepRail({ sessionId, statuses }: StepRailProps) {
  return (
    <nav
      aria-label="Workspaces"
      className="scroll-fade-x flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-x-visible md:pb-0"
    >
      {WORKSPACE_STEPS.map((step, index) => (
        <NavLink
          key={step.id}
          to={`/sessions/${sessionId}/${step.id}`}
          className={({ isActive }) =>
            cn(
              "flex min-w-max items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors md:min-w-0",
              isActive ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted",
            )
          }
        >
          {({ isActive }) => (
            <>
              <StepMarker
                index={index}
                status={statuses?.get(step.id) ?? "not_started"}
                active={isActive}
              />
              <span className="truncate">{step.title}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
