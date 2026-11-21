import { BasisBadge } from "@/components/shared/BasisBadge"
import { IdList } from "@/components/shared/IdList"
import type { SystemRef } from "@/api/types"

interface SystemsPanelProps {
  title: string
  systems: readonly SystemRef[]
  onSelectId?: (id: string) => void
}

export function SystemsPanel({ title, systems, onSelectId }: SystemsPanelProps) {
  if (systems.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-heading text-sm font-medium tracking-tight">{title}</h3>
      <ul className="flex flex-col gap-2">
        {systems.map((system) => (
          <li key={system.name} className="flex flex-col gap-1 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{system.name}</span>
              <BasisBadge basis={system.basis} />
            </div>
            {system.description ? (
              <span className="text-sm text-muted-foreground">{system.description}</span>
            ) : null}
            <IdList
              ids={system.req_ids}
              label={`${system.name} requirements`}
              onSelect={onSelectId}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
