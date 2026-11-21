import { Link } from "react-router"
import { InfoIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { Session, SystemInfo } from "@/api/types"

interface MockScenarioNoticeProps {
  system: SystemInfo | undefined
  session: Pick<Session, "scenario_slug">
}

/** Said before any text is pasted: mock mode only analyses the four sample scenarios. */
export function MockScenarioNotice({ system, session }: MockScenarioNoticeProps) {
  if (!system || system.ai_mode !== "mock" || session.scenario_slug) return null
  return (
    <Alert>
      <InfoIcon />
      <AlertTitle>Mock mode analyses the sample scenarios only</AlertTitle>
      <AlertDescription>
        Recorded answers exist for the four seeded scenarios, so text pasted here cannot be analysed
        in mock mode.{" "}
        <Link to="/scenarios" className="underline">
          Start from a sample scenario
        </Link>
        , or add an AI key to <code>backend/.env</code> to analyse your own text.
      </AlertDescription>
    </Alert>
  )
}
