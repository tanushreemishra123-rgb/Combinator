import { InfoIcon, PlayIcon } from "lucide-react"
import { useRunAnalysis } from "@/api/hooks/analysis"
import { FindingsNotice } from "@/components/shared/FindingsNotice"
import { ErrorState } from "@/components/shared/ErrorState"
import { SectionCard } from "@/components/shared/SectionCard"
import { StageButton } from "@/components/shared/StageButton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface AnalysisPanelProps {
  sessionId: string
  hasDocuments: boolean
  locked: boolean
  /** True when the app replays recorded answers and this session is not a sample scenario. */
  replaysSample: boolean
  onSelectId?: (id: string) => void
}

export function AnalysisPanel({
  sessionId,
  hasDocuments,
  locked,
  replaysSample,
  onSelectId,
}: AnalysisPanelProps) {
  const analysis = useRunAnalysis(sessionId)
  const result = analysis.data

  return (
    <SectionCard
      title="Run requirement analysis"
      description="Extracts the scope, gaps, assumptions and questions."
    >
      <div className="flex flex-col gap-4">
        {replaysSample && !locked ? (
          <Alert>
            <InfoIcon />
            <AlertTitle>Mock mode only analyzes the sample scenarios</AlertTitle>
            <AlertDescription>
              No AI key is configured, and recorded answers exist only for the sample scenarios. To
              analyze your own text, add a free Gemini key to backend/.env (steps in the README) and
              restart. Or start from a sample scenario.
            </AlertDescription>
          </Alert>
        ) : null}
        <StageButton
          running={analysis.isPending}
          stage="Reading the customer input and extracting the scope"
          disabled={!hasDocuments || locked || replaysSample}
          onClick={() => analysis.mutate()}
        >
          <PlayIcon data-icon="inline-start" />
          Run requirement analysis
        </StageButton>
        {!hasDocuments ? (
          <p className="text-sm text-muted-foreground">
            Add customer input first — the analysis only reads what the customer sent.
          </p>
        ) : null}
        {analysis.isError ? <ErrorState error={analysis.error} /> : null}
        {result?.mock_notice ? (
          <Alert>
            <AlertDescription>{result.mock_notice}</AlertDescription>
          </Alert>
        ) : null}
        <FindingsNotice findings={result?.findings ?? []} onSelectId={onSelectId} />
      </div>
    </SectionCard>
  )
}
