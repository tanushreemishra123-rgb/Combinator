import { GroundedItem } from "@/components/prd/GroundedItem"
import { IdBadge } from "@/components/shared/IdBadge"
import type { PrdRequirement } from "@/api/types"

interface RequirementSectionProps {
  title: string
  requirements: readonly PrdRequirement[]
  onSelectId?: (id: string) => void
}

export function RequirementSection({ title, requirements, onSelectId }: RequirementSectionProps) {
  if (requirements.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-heading text-sm font-medium tracking-tight">{title}</h3>
      <ul className="flex flex-col gap-2">
        {requirements.map((requirement) => (
          <GroundedItem
            key={requirement.req_id}
            title={<IdBadge id={requirement.req_id} onSelect={onSelectId} />}
            text={requirement.statement}
            element={requirement}
            onSelectId={onSelectId}
          >
            {requirement.acceptance_conditions.length > 0 ? (
              <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-muted-foreground">
                {requirement.acceptance_conditions.map((condition) => (
                  <li key={condition}>{condition}</li>
                ))}
              </ul>
            ) : null}
          </GroundedItem>
        ))}
      </ul>
    </section>
  )
}
