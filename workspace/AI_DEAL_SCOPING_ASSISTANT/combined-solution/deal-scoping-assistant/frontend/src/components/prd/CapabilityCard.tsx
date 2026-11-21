import { BasisBadge } from "@/components/shared/BasisBadge"
import { IdBadge } from "@/components/shared/IdBadge"
import { IdList } from "@/components/shared/IdList"
import { KeyValueList } from "@/components/shared/KeyValueList"
import { PriorityBadge } from "@/components/shared/PriorityBadge"
import { ValidationBadge } from "@/components/shared/ValidationBadge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { label } from "@/lib/labels"
import type { Capability } from "@/api/types"

interface CapabilityCardProps {
  capability: Capability
  workstreamName: string
  moduleName: string
  /** Package name plus how it would be delivered, e.g. "Core build — Topcoder challenges". */
  deliveryPackage: string
  onSelectId?: (id: string) => void
}

export function CapabilityCard({
  capability,
  workstreamName,
  moduleName,
  deliveryPackage,
  onSelectId,
}: CapabilityCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <IdBadge id={capability.id} />
          {capability.name}
        </CardTitle>
        <CardDescription>{capability.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{label(capability.scope_class)}</Badge>
          <PriorityBadge priority={capability.priority} />
          <BasisBadge basis={capability.basis} />
          {capability.validation_required ? (
            <ValidationBadge reason={capability.validation_reason} />
          ) : null}
        </div>
        <KeyValueList
          items={[
            {
              label: "Included requirements",
              value: (
                <IdList
                  ids={capability.included_req_ids}
                  label="Included requirements"
                  onSelect={onSelectId}
                />
              ),
            },
            { label: "Module", value: moduleName || "—" },
            { label: "Workstream", value: workstreamName || "—" },
            { label: "Delivery package", value: deliveryPackage || "—" },
            {
              label: "Dependencies",
              value: capability.dependencies.length ? capability.dependencies.join(", ") : "None",
            },
          ]}
        />
      </CardContent>
    </Card>
  )
}
