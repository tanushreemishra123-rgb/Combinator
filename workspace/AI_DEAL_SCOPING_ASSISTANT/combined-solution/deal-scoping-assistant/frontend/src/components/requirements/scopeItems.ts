import type { ItemStatus, ItemType, ScopeItem, ScopeView } from "@/api/types"

/** The grouped view flattened into one list, keeping the API's group order. */
export function flattenScope(view: ScopeView | undefined): ScopeItem[] {
  return (view?.groups ?? []).flatMap((group) => group.items)
}

export function itemsOfType(view: ScopeView | undefined, type: ItemType): ScopeItem[] {
  return view?.groups.find((group) => group.type === type)?.items ?? []
}

export function findScopeItem(
  view: ScopeView | undefined,
  itemId: string | null,
): ScopeItem | undefined {
  if (!itemId) return undefined
  return flattenScope(view).find((item) => item.id === itemId)
}

export const ITEM_STATUSES: readonly ItemStatus[] = ["proposed", "approved", "modified", "rejected"]

/** Counted into a Map, so a status coming off the wire is never used as a property name. */
export function countByStatus(items: readonly ScopeItem[]): ReadonlyMap<ItemStatus, number> {
  const counts = new Map<ItemStatus, number>(ITEM_STATUSES.map((status) => [status, 0]))
  for (const item of items) counts.set(item.status, (counts.get(item.status) ?? 0) + 1)
  return counts
}

/** Questions raised for a gap the analysis marked critical. */
export function criticalQuestionIds(view: ScopeView | undefined): Set<string> {
  const ids = new Set<string>()
  for (const gap of itemsOfType(view, "GAP")) {
    const details = gap.details?.gap
    if (!details || details.criticality !== "high") continue
    if (details.question_id) ids.add(details.question_id)
    for (const related of gap.related_ids ?? []) {
      if (related.startsWith("Q_")) ids.add(related)
    }
  }
  return ids
}

export const ITEM_TYPES: readonly ItemType[] = [
  "BR",
  "PER",
  "FR",
  "NFR",
  "SYS",
  "INT",
  "DATA",
  "SEC",
  "TECH",
  "CON",
  "DEP",
  "RISK",
  "GAP",
  "ASM",
  "Q",
]

export const ORIGINS = ["customer_stated", "ai_inferred", "assumed"] as const
export const PRIORITIES = ["must", "high", "medium", "low"] as const
