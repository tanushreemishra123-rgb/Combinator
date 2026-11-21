import type { Artifact, ArtifactKind, ArtifactStatus, ExportStatus, Session } from "@/api/types"
import type { Status } from "@/components/shared/types"
import { WORKSPACE_STEPS } from "@/components/layout/steps"
import type { WorkspaceId } from "@/components/layout/steps"
import { lookupTable } from "@/lib/lookup"

// What each workspace has to produce before it counts as done.
const WORKSPACE_ARTIFACTS = lookupTable<WorkspaceId, readonly ArtifactKind[]>({
  requirements: [],
  "prd-scope": ["prd", "functional_scope"],
  architecture: ["architecture"],
  "data-integration-ai": ["data_strategy", "integration_architecture", "ai_strategy"],
  estimate: ["estimate_drivers", "estimate"],
  package: ["executive_summary"],
})

/** Only the two fields the rail needs, so callers can pass an artifact list as-is. */
export type ArtifactState = Pick<Artifact, "kind" | "status">

/** Only the scope status drives the requirements step. */
export type SessionState = Pick<Session, "scope_status">

function requirementsStatus(session: SessionState | undefined): Status {
  if (session?.scope_status === "approved") return "approved"
  if (session?.scope_status === "analyzed") return "ready"
  return "not_started"
}

function artifactStatus(
  kinds: readonly ArtifactKind[],
  byKind: ReadonlyMap<ArtifactKind, ArtifactStatus>,
): Status {
  const present = kinds.map((kind) => byKind.get(kind)).filter((status) => status !== undefined)
  if (present.length === 0) return "not_started"
  if (present.includes("stale")) return "stale"
  // Some workspaces produce several artifacts; "ready" means started but not complete.
  return present.length === kinds.length ? "done" : "ready"
}

/**
 * The package is only finished when the quality gate says it can go out, so the export
 * status refines what the executive summary alone would report.
 */
function packageStatus(base: Status, exportStatus: ExportStatus | undefined): Status {
  if (!exportStatus || base === "not_started") return base
  if (exportStatus === "blocked") return "stale"
  if (exportStatus === "review_required") return base === "done" ? "ready" : base
  return base
}

/** Step-rail status for every workspace, derived from the session and its artifacts. */
export function deriveStepStatuses(
  session: SessionState | undefined,
  artifacts: readonly ArtifactState[] | undefined,
  exportStatus?: ExportStatus,
): ReadonlyMap<WorkspaceId, Status> {
  const byKind = new Map((artifacts ?? []).map((artifact) => [artifact.kind, artifact.status]))
  const statuses = new Map<WorkspaceId, Status>()
  for (const step of WORKSPACE_STEPS) {
    if (step.id === "requirements") {
      statuses.set(step.id, requirementsStatus(session))
      continue
    }
    const base = artifactStatus(WORKSPACE_ARTIFACTS.get(step.id) ?? [], byKind)
    statuses.set(step.id, step.id === "package" ? packageStatus(base, exportStatus) : base)
  }
  return statuses
}
