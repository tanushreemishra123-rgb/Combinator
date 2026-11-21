import { ComponentCard } from "@/components/architecture/ComponentCard"
import { Badge } from "@/components/ui/badge"
import { ARCHITECTURE_AREAS, label } from "@/lib/labels"
import type { ArchitectureComponent } from "@/api/types"

interface ComponentAreasProps {
  components: readonly ArchitectureComponent[]
  onSelectId?: (id: string) => void
}

/** Components grouped into the challenge's 14 areas; empty areas are named, not hidden. */
export function ComponentAreas({ components, onSelectId }: ComponentAreasProps) {
  const covered = ARCHITECTURE_AREAS.map((area) => ({
    area,
    items: components.filter((component) => component.area === area),
  })).filter((group) => group.items.length > 0)

  const missing = ARCHITECTURE_AREAS.filter(
    (area) => !components.some((component) => component.area === area),
  )

  return (
    <div className="flex flex-col gap-6">
      {covered.map((group) => (
        <section key={group.area} className="flex flex-col gap-3">
          <h3 className="font-heading text-sm font-medium tracking-tight">{label(group.area)}</h3>
          <div className="grid gap-4 xl:grid-cols-2">
            {group.items.map((component) => (
              <ComponentCard key={component.id} component={component} onSelectId={onSelectId} />
            ))}
          </div>
        </section>
      ))}
      {missing.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="font-heading text-sm font-medium tracking-tight">
            Areas with no component
          </h3>
          <div className="flex flex-wrap gap-1">
            {missing.map((area) => (
              <Badge key={area} variant="ghost">
                {label(area)}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
