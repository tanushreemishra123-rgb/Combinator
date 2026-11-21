import { IdList } from "@/components/shared/IdList"
import { KeyValueList } from "@/components/shared/KeyValueList"
import { formatPercent } from "@/lib/format"
import type { CoverageReport } from "@/api/types"

interface CoverageSummaryProps {
  report: CoverageReport
  onSelectId?: (id: string) => void
}

export function CoverageSummary({ report, onSelectId }: CoverageSummaryProps) {
  return (
    <KeyValueList
      items={[
        {
          label: "Requirement coverage",
          value: `${formatPercent(report.coverage_pct)} — ${report.covered_count} of ${report.counted_count} counted requirements`,
        },
        {
          label: "Must and high coverage",
          value: `${formatPercent(report.high_priority_pct)} — ${report.high_priority_covered_count} of ${report.high_priority_count}`,
        },
        {
          label: "Uncovered requirements",
          value: report.uncovered_ids?.length ? (
            <IdList
              ids={report.uncovered_ids}
              label="Uncovered requirements"
              onSelect={onSelectId}
            />
          ) : (
            "None"
          ),
        },
        {
          label: "Uncovered must and high",
          value: report.high_priority_uncovered_ids?.length ? (
            <IdList
              ids={report.high_priority_uncovered_ids}
              label="Uncovered high-priority requirements"
              onSelect={onSelectId}
            />
          ) : (
            "None"
          ),
        },
      ]}
    />
  )
}
