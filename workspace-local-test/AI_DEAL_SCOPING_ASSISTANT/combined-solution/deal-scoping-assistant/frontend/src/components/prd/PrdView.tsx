import { JourneySection, PersonaSection } from "@/components/prd/PersonaSection"
import { OutOfScopeSection } from "@/components/prd/OutOfScopeSection"
import { RequirementSection } from "@/components/prd/RequirementSection"
import { StatementSection } from "@/components/prd/StatementSection"
import { TraceabilitySection } from "@/components/prd/TraceabilitySection"
import { Separator } from "@/components/ui/separator"
import type { PrdContent } from "@/api/types"

interface PrdViewProps {
  prd: PrdContent
  onSelectId?: (id: string) => void
}

export function PrdView({ prd, onSelectId }: PrdViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="font-heading text-sm font-medium tracking-tight">Solution overview</h3>
        <p className="max-w-prose text-sm leading-relaxed">{prd.overview}</p>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-heading text-sm font-medium tracking-tight">Business problem</h3>
        <p className="max-w-prose text-sm leading-relaxed">{prd.business_problem}</p>
      </section>
      <Separator />
      <StatementSection
        title="Business objectives"
        statements={prd.objectives}
        onSelectId={onSelectId}
      />
      <PersonaSection personas={prd.personas} onSelectId={onSelectId} />
      <JourneySection journeys={prd.user_journeys} onSelectId={onSelectId} />
      <RequirementSection
        title="Functional requirements"
        requirements={prd.functional_requirements}
        onSelectId={onSelectId}
      />
      <RequirementSection
        title="Non-functional requirements"
        requirements={prd.non_functional_requirements}
        onSelectId={onSelectId}
      />
      <StatementSection
        title="Integrations"
        statements={prd.integrations}
        onSelectId={onSelectId}
      />
      <StatementSection
        title="Dependencies"
        statements={prd.dependencies}
        onSelectId={onSelectId}
      />
      <StatementSection title="Assumptions" statements={prd.assumptions} onSelectId={onSelectId} />
      <StatementSection title="Risks" statements={prd.risks} onSelectId={onSelectId} />
      <OutOfScopeSection items={prd.out_of_scope} onSelectId={onSelectId} />
      <StatementSection
        title="Open questions"
        statements={prd.open_questions}
        onSelectId={onSelectId}
      />
      <TraceabilitySection entries={prd.traceability} onSelectId={onSelectId} />
    </div>
  )
}
