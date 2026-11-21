import { BasisBadge } from "@/components/shared/BasisBadge"
import { IdBadge } from "@/components/shared/IdBadge"
import { IdList } from "@/components/shared/IdList"
import { KeyValueList } from "@/components/shared/KeyValueList"
import { ValidationBadge } from "@/components/shared/ValidationBadge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ArchitectureComponent } from "@/api/types"

interface ComponentCardProps {
  component: ArchitectureComponent
  onSelectId?: (id: string) => void
}

export function ComponentCard({ component, onSelectId }: ComponentCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <IdBadge id={component.id} />
          {component.name}
        </CardTitle>
        <CardDescription>{component.purpose}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{component.cloud_service}</Badge>
          <BasisBadge basis={component.basis} />
          {component.validation_required ? (
            <ValidationBadge reason={component.validation_reason} />
          ) : null}
        </div>
        <KeyValueList
          items={[
            {
              label: "Justified by",
              value: (
                <IdList
                  ids={component.supported_ids}
                  label={`${component.id} supported requirements`}
                  onSelect={onSelectId}
                />
              ),
            },
            { label: "Why this service", value: component.rationale },
            {
              label: "Trade-offs",
              value: component.trade_offs.length ? (
                <ul className="flex list-disc flex-col gap-0.5 pl-4">
                  {component.trade_offs.map((tradeOff) => (
                    <li key={tradeOff}>{tradeOff}</li>
                  ))}
                </ul>
              ) : (
                "None recorded"
              ),
            },
            {
              label: "Depends on",
              value: component.dependencies.length ? (
                <IdList
                  ids={component.dependencies}
                  label={`${component.id} dependencies`}
                  onSelect={onSelectId}
                />
              ) : (
                "Nothing"
              ),
            },
            { label: "Security", value: component.security_considerations || "Not stated" },
            {
              label: "Environments",
              value: component.environments.length
                ? component.environments.join(", ")
                : "Not stated",
            },
          ]}
        />
      </CardContent>
    </Card>
  )
}
