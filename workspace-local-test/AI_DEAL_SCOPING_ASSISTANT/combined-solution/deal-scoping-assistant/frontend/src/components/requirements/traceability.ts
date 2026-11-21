import type { ScopeItem, ScopeView } from "@/api/types"
import { flattenScope, itemsOfType } from "@/components/requirements/scopeItems"

/**
 * An assumed item must be traceable to customer text or to an explicit absence, so the
 * gaps and questions it rests on are collected from both directions of the link.
 */
export function traceabilityLinks(view: ScopeView | undefined, item: ScopeItem): ScopeItem[] {
  const ids = new Set(item.related_ids ?? [])
  for (const gap of itemsOfType(view, "GAP")) {
    const details = gap.details?.gap
    if (details?.assumption_id === item.id || details?.question_id === item.id) ids.add(gap.id)
  }
  for (const question of itemsOfType(view, "Q")) {
    if ((question.details?.question?.affected_ids ?? []).includes(item.id)) ids.add(question.id)
  }
  return flattenScope(view).filter(
    (candidate) => ids.has(candidate.id) && (candidate.type === "GAP" || candidate.type === "Q"),
  )
}
