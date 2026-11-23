import { CalculatorIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/** The spec forbids unsupported LLM numbers, so the split of work is stated up front. */
export function DriversNotice() {
  return (
    <Alert>
      <CalculatorIcon />
      <AlertTitle>Numbers are calculated by documented rules, not by the AI model</AlertTitle>
      <AlertDescription>
        The assistant only suggests the workstreams, the units and their complexity. Effort,
        timeline and commercials come from the rate card, the factors and the rules below, and every
        line shows its own arithmetic.
      </AlertDescription>
    </Alert>
  )
}
