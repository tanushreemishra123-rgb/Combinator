import { useMemo, useState } from "react"
import { AddScopeItemDialog } from "@/components/requirements/AddScopeItemDialog"
import { ScopeFilters } from "@/components/requirements/ScopeFilters"
import { ScopeTable } from "@/components/requirements/ScopeTable"
import { ALL_FILTERS, filterScopeItems } from "@/components/requirements/scopeFilter"
import { flattenScope } from "@/components/requirements/scopeItems"
import { SectionCard } from "@/components/shared/SectionCard"
import type { ScopeItem, ScopeView } from "@/api/types"

interface ScopeReviewProps {
  sessionId: string
  scope: ScopeView | undefined
  locked: boolean
  onSelect: (item: ScopeItem) => void
}

export function ScopeReview({ sessionId, scope, locked, onSelect }: ScopeReviewProps) {
  const [filters, setFilters] = useState(ALL_FILTERS)
  const items = useMemo(() => flattenScope(scope), [scope])
  const visible = useMemo(() => filterScopeItems(items, filters), [items, filters])

  return (
    <SectionCard
      title="Review the extracted scope"
      description={`${visible.length} of ${items.length} items. Open one to see its source.`}
      actions={locked ? null : <AddScopeItemDialog sessionId={sessionId} />}
    >
      <div className="flex flex-col gap-4">
        <ScopeFilters filters={filters} onChange={setFilters} />
        <div className="overflow-x-auto">
          <ScopeTable items={visible} onSelect={onSelect} />
        </div>
      </div>
    </SectionCard>
  )
}
