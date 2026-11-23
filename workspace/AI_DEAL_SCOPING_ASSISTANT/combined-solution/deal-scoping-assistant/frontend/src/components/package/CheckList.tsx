import { CircleAlertIcon, CircleCheckIcon, CircleMinusIcon, TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"
import type { ComponentType, SVGProps } from "react"
import { IdList } from "@/components/shared/IdList"
import { Badge } from "@/components/ui/badge"
import { label } from "@/lib/labels"
import { statusTone, toneBadgeVariant, toneTextClass } from "@/lib/status"
import { lookupTable } from "@/lib/lookup"
import type { CheckStatus, QualityCheckResult } from "@/api/types"

const ICONS = lookupTable<CheckStatus, ComponentType<SVGProps<SVGSVGElement>>>({
  passed: CircleCheckIcon,
  warning: TriangleAlertIcon,
  failed: CircleAlertIcon,
  not_applicable: CircleMinusIcon,
})

interface CheckListProps {
  checks: readonly QualityCheckResult[]
  onSelectId?: (id: string) => void
}

export function CheckList({ checks, onSelectId }: CheckListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {checks.map((check) => {
        const Icon = ICONS.get(check.status) ?? CircleMinusIcon
        const tone = statusTone(check.status)
        return (
          <li key={check.id} className="flex gap-3 rounded-lg border p-3">
            <Icon className={cn("mt-0.5 size-4 shrink-0", toneTextClass(tone))} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{check.name}</span>
                <Badge
                  variant={toneBadgeVariant(tone)}
                  aria-label={`Status: ${label(check.status)}`}
                >
                  {label(check.status)}
                </Badge>
                <Badge variant="ghost">{check.id}</Badge>
              </div>
              <span className="text-sm text-muted-foreground">{check.message}</span>
              <IdList
                ids={check.affected_ids}
                label={`${check.id} affected items`}
                onSelect={onSelectId}
              />
              {check.status !== "passed" && check.remediation ? (
                <span className="text-sm">How to fix: {check.remediation}</span>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
