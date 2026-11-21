import { AssumptionPanel } from "@/components/requirements/AssumptionPanel"
import { GapPanel } from "@/components/requirements/GapPanel"
import { QuestionPanel } from "@/components/requirements/QuestionPanel"
import { SectionCard } from "@/components/shared/SectionCard"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ScopeItem } from "@/api/types"

interface ReviewTabsProps {
  sessionId: string
  gaps: readonly ScopeItem[]
  assumptions: readonly ScopeItem[]
  questions: readonly ScopeItem[]
  criticalIds: ReadonlySet<string>
  locked: boolean
  onSelectId: (id: string) => void
}

function TabLabel({ text, count }: { text: string; count: number }) {
  return (
    <span className="flex items-center gap-1.5">
      {text}
      <Badge variant="ghost">{count}</Badge>
    </span>
  )
}

/** One card for the three review lists, so the page is not three stacked panels. */
export function ReviewTabs({
  sessionId,
  gaps,
  assumptions,
  questions,
  criticalIds,
  locked,
  onSelectId,
}: ReviewTabsProps) {
  return (
    <SectionCard title="Clarify missing information">
      <Tabs defaultValue="gaps">
        <TabsList>
          <TabsTrigger value="gaps">
            <TabLabel text="Missing information" count={gaps.length} />
          </TabsTrigger>
          <TabsTrigger value="assumptions">
            <TabLabel text="Assumptions" count={assumptions.length} />
          </TabsTrigger>
          <TabsTrigger value="questions">
            <TabLabel text="Questions" count={questions.length} />
          </TabsTrigger>
        </TabsList>
        <TabsContent value="gaps" className="pt-4">
          <GapPanel gaps={gaps} onSelectId={onSelectId} />
        </TabsContent>
        <TabsContent value="assumptions" className="pt-4">
          <AssumptionPanel
            sessionId={sessionId}
            assumptions={assumptions}
            locked={locked}
            onSelectId={onSelectId}
          />
        </TabsContent>
        <TabsContent value="questions" className="pt-4">
          <QuestionPanel
            sessionId={sessionId}
            questions={questions}
            criticalIds={criticalIds}
            locked={locked}
            onSelectId={onSelectId}
          />
        </TabsContent>
      </Tabs>
    </SectionCard>
  )
}
