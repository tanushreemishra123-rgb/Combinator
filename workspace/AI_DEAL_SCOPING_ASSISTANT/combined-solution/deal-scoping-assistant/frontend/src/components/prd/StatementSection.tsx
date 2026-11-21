import { GroundedItem } from "@/components/prd/GroundedItem"
import type { ContentStatement } from "@/api/types"

interface StatementSectionProps {
  title: string
  statements: readonly ContentStatement[]
  onSelectId?: (id: string) => void
}

export function StatementSection({ title, statements, onSelectId }: StatementSectionProps) {
  if (statements.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-heading text-sm font-medium tracking-tight">{title}</h3>
      <ul className="flex flex-col gap-2">
        {statements.map((statement, index) => (
          <GroundedItem
            key={`${statement.text}-${index}`}
            text={statement.text}
            element={statement}
            onSelectId={onSelectId}
          />
        ))}
      </ul>
    </section>
  )
}
