import { StatementSection } from "@/components/prd/StatementSection"
import type { ExecutiveSummaryContent } from "@/api/types"

interface ExecutiveSummaryViewProps {
  summary: ExecutiveSummaryContent
  onSelectId?: (id: string) => void
}

/** The generated summary as the package will open with it. */
export function ExecutiveSummaryView({ summary, onSelectId }: ExecutiveSummaryViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed">{summary.overview}</p>
      <StatementSection
        title="Customer objectives"
        statements={summary.customer_objectives}
        onSelectId={onSelectId}
      />
      <StatementSection
        title="Solution highlights"
        statements={summary.solution_highlights}
        onSelectId={onSelectId}
      />
      {summary.commercial_summary ? (
        <section className="flex flex-col gap-2">
          <h3 className="font-heading text-sm font-medium tracking-tight">Commercial summary</h3>
          <p className="text-sm leading-relaxed">{summary.commercial_summary}</p>
        </section>
      ) : null}
      <StatementSection title="Key risks" statements={summary.key_risks} onSelectId={onSelectId} />
      <StatementSection
        title="Next steps"
        statements={summary.next_steps}
        onSelectId={onSelectId}
      />
    </div>
  )
}
