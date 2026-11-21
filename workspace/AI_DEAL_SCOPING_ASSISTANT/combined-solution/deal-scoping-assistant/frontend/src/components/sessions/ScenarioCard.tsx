import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { label } from "@/lib/labels"
import type { Scenario } from "@/api/types"

interface ScenarioCardProps {
  scenario: Scenario
  starting: boolean
  onStart: (slug: string) => void
}

export function ScenarioCard({ scenario, starting, onStart }: ScenarioCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{scenario.title}</CardTitle>
        <CardDescription>{scenario.customer_name}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">{label(scenario.scenario_type)}</Badge>
          <Badge variant="ghost">{scenario.industry}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{scenario.opportunity_summary}</p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" disabled={starting} onClick={() => onStart(scenario.slug)}>
          {starting ? <Spinner data-icon="inline-start" /> : null}
          Start from this scenario
        </Button>
      </CardFooter>
    </Card>
  )
}
