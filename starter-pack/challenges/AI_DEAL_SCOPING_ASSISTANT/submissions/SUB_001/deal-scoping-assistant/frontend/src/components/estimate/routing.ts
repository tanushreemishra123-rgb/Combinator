import { configChange, unitComplexityChange } from "@/components/package/changeRequests"
import type { ChangeRequest, Complexity, ScopeStatus, SessionConfigInput } from "@/api/types"

/**
 * Before the first approval the estimation inputs are edited directly. Afterwards the backend
 * refuses a direct write (409) and the edit has to be recorded with its impact.
 */
export type EditRoute = "direct" | "change_request"

export function editRoute(scopeStatus: ScopeStatus): EditRoute {
  return scopeStatus === "approved" ? "change_request" : "direct"
}

export function complexityChangeRequest(unitId: string, complexity: Complexity): ChangeRequest {
  return unitComplexityChange(unitId, complexity, `Complexity of ${unitId} set to ${complexity}`)
}

export function configChangeRequest(config: SessionConfigInput): ChangeRequest {
  return configChange(config, "Estimation inputs updated")
}
