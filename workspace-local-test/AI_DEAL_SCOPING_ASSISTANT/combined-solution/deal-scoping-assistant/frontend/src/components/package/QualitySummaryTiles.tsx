import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPercent } from "@/lib/format"
import { label } from "@/lib/labels"
import { statusTone, toneBadgeVariant } from "@/lib/status"
import type { QualitySummary } from "@/api/types"

function Tile({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="tabular-nums">{value}</CardTitle>
      </CardHeader>
      {note ? <CardContent className="text-xs text-muted-foreground">{note}</CardContent> : null}
    </Card>
  )
}

export function QualitySummaryTiles({ summary }: { summary: QualitySummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Tile title="Requirement coverage" value={formatPercent(summary.coverage_pct)} />
      <Tile title="Uncovered requirements" value={String(summary.uncovered_requirements)} />
      <Tile title="Unresolved questions" value={String(summary.unresolved_questions)} />
      <Tile
        title="Unsupported recommendations"
        value={String(summary.unsupported_recommendations)}
      />
      <Tile title="Estimate confidence" value={label(summary.estimate_confidence)} />
      <Card>
        <CardHeader>
          <CardDescription>Export status</CardDescription>
          <CardTitle>
            <Badge variant={toneBadgeVariant(statusTone(summary.export_status))}>
              {label(summary.export_status)}
            </Badge>
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  )
}
