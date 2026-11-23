import { SearchIcon } from "lucide-react"
import { FilterSelect } from "@/components/shared/FilterSelect"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  ITEM_STATUSES,
  ITEM_TYPES,
  ORIGINS,
  PRIORITIES,
} from "@/components/requirements/scopeItems"
import type { ScopeFilterState } from "@/components/requirements/scopeFilter"
import { itemTypePlural } from "@/lib/labels"

interface ScopeFiltersProps {
  filters: ScopeFilterState
  onChange: (filters: ScopeFilterState) => void
}

export function ScopeFilters({ filters, onChange }: ScopeFiltersProps) {
  const set = <K extends keyof ScopeFilterState>(key: K, value: ScopeFilterState[K]) =>
    onChange({ ...filters, [key]: value })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputGroup className="w-full sm:w-64">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search the scope"
          placeholder="Search id, title or wording"
          value={filters.search}
          onChange={(event) => set("search", event.target.value)}
        />
      </InputGroup>
      <FilterSelect
        name="Type"
        allLabel="All types"
        value={filters.type}
        options={ITEM_TYPES}
        format={itemTypePlural}
        onChange={(value) => set("type", value)}
        className="w-48"
      />
      <FilterSelect
        name="Origin"
        allLabel="All origins"
        value={filters.origin}
        options={ORIGINS}
        onChange={(value) => set("origin", value)}
        className="w-44"
      />
      <FilterSelect
        name="Priority"
        allLabel="All priorities"
        value={filters.priority}
        options={PRIORITIES}
        onChange={(value) => set("priority", value)}
        className="w-40"
      />
      <FilterSelect
        name="Status"
        allLabel="All statuses"
        value={filters.status}
        options={ITEM_STATUSES}
        onChange={(value) => set("status", value)}
        className="w-40"
      />
    </div>
  )
}
