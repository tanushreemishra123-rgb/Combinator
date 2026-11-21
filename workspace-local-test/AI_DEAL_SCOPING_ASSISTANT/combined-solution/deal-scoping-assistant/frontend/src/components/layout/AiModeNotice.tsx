import { InfoIcon, TriangleAlertIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { aiTarget, fallbackNotice } from "@/components/layout/aiMode"
import type { SystemInfo } from "@/api/types"

/** One line: live mode sends customer text away, mock mode explains a failed live setup. */
export function AiModeNotice({ system }: { system: SystemInfo }) {
  if (system.ai_mode === "live") {
    return (
      <Alert>
        <InfoIcon />
        <AlertDescription>
          Live mode: customer text from this session is sent to{" "}
          {aiTarget(system) || "the configured provider"}.
        </AlertDescription>
      </Alert>
    )
  }
  const fallback = fallbackNotice(system)
  if (!fallback) return null
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertDescription>{fallback} Recorded answers are used instead.</AlertDescription>
    </Alert>
  )
}
