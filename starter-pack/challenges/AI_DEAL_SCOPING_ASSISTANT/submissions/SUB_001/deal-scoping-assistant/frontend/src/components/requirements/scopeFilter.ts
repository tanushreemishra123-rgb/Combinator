import type { ItemStatus, ItemType, Origin, Priority, ScopeItem } from "@/api/types"

export interface ScopeFilterState {
  search: string
  type: ItemType | "all"
  origin: Origin | "all"
  priority: Priority | "all"
  status: ItemStatus | "all"
}

export const ALL_FILTERS: ScopeFilterState = {
  search: "",
  type: "all",
  origin: "all",
  priority: "all",
  status: "all",
}

function matchesSearch(item: ScopeItem, search: string): boolean {
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  // Reviewers search by id as often as by wording.
  return [item.id, item.title, item.description ?? ""].some((field) =>
    field.toLowerCase().includes(needle),
  )
}

export function filterScopeItems(
  items: readonly ScopeItem[],
  filters: ScopeFilterState,
): ScopeItem[] {
  return items.filter(
    (item) =>
      (filters.type === "all" || item.type === filters.type) &&
      (filters.origin === "all" || item.origin === filters.origin) &&
      (filters.priority === "all" || item.priority === filters.priority) &&
      (filters.status === "all" || item.status === filters.status) &&
      matchesSearch(item, filters.search),
  )
}
