import type { ItemStatus, ScopeItem, ScopeView } from "@/api/types"
import {
  countByStatus,
  criticalQuestionIds,
  flattenScope,
  itemsOfType,
} from "@/components/requirements/scopeItems"

export interface ApprovalSummary {
  counts: ReadonlyMap<ItemStatus, number>
  total: number
  /** Open questions raised for a critical gap; a warning, not a blocker. */
  unresolvedCritical: ScopeItem[]
  pendingAssumptions: number
  canApprove: boolean
  blockedReason: string | null
}

export function summarizeApproval(view: ScopeView | undefined): ApprovalSummary {
  const items = flattenScope(view)
  const critical = criticalQuestionIds(view)
  const unresolvedCritical = itemsOfType(view, "Q").filter(
    (question) =>
      critical.has(question.id) && (question.details?.question?.answer_status ?? "open") === "open",
  )
  const pendingAssumptions = itemsOfType(view, "ASM").filter(
    (assumption) =>
      (assumption.details?.assumption?.confirmation_status ?? "pending") === "pending",
  ).length

  const blockedReason = view?.locked
    ? "This scope is already approved."
    : items.length === 0
      ? "Run the requirement analysis before approving."
      : null

  return {
    counts: countByStatus(items),
    total: items.length,
    unresolvedCritical,
    pendingAssumptions,
    canApprove: blockedReason === null,
    blockedReason,
  }
}
