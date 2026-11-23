import { CapabilityCard } from "@/components/prd/CapabilityCard"
import { label } from "@/lib/labels"
import type { FunctionalScopeContent } from "@/api/types"

interface FunctionalScopeViewProps {
  scope: FunctionalScopeContent
  onSelectId?: (id: string) => void
}

export function FunctionalScopeView({ scope, onSelectId }: FunctionalScopeViewProps) {
  const workstreams = new Map(scope.workstreams.map((item) => [item.id, item.name]))
  const modules = new Map(scope.modules.map((item) => [item.id, item.name]))
  const packages = new Map(
    scope.delivery_packages.map((item) => [
      item.id,
      `${item.name} — ${label(item.engagement_model)}`,
    ]),
  )

  if (scope.capabilities.length === 0) {
    return <p className="text-sm text-muted-foreground">No capabilities were produced.</p>
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {scope.capabilities.map((capability) => (
        <CapabilityCard
          key={capability.id}
          capability={capability}
          workstreamName={workstreams.get(capability.workstream_id) ?? capability.workstream_id}
          moduleName={modules.get(capability.module) ?? capability.module}
          deliveryPackage={packages.get(capability.delivery_package_id) ?? ""}
          onSelectId={onSelectId}
        />
      ))}
    </div>
  )
}
