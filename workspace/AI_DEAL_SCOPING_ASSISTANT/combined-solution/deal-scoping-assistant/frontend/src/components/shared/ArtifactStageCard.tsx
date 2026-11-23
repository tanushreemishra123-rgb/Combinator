import type { ReactNode } from "react"
import { RefreshCwIcon, PlayIcon, TriangleAlertIcon } from "lucide-react"
import { useGenerateArtifact } from "@/api/hooks/artifacts"
import { ErrorState } from "@/components/shared/ErrorState"
import { FindingsNotice } from "@/components/shared/FindingsNotice"
import { SectionCard } from "@/components/shared/SectionCard"
import { StageButton } from "@/components/shared/StageButton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { artifactStepLabel } from "@/lib/labels"
import type { Artifact, ArtifactKind, GenerateOptions } from "@/api/types"

interface ArtifactStageCardProps {
  sessionId: string
  kind: ArtifactKind
  description?: string
  artifact: Artifact | undefined
  /** Why the stage cannot run yet, e.g. the scope is not approved. */
  blockedReason?: string | null
  options?: GenerateOptions
  children?: ReactNode
}

/** One generation stage: its prerequisite state, its stale state and its result. */
export function ArtifactStageCard({
  sessionId,
  kind,
  description,
  artifact,
  blockedReason,
  options,
  children,
}: ArtifactStageCardProps) {
  const generate = useGenerateArtifact(sessionId)
  const stale = artifact?.status === "stale"
  const title = artifactStepLabel(kind)

  return (
    <SectionCard
      title={title}
      description={description}
      actions={
        artifact ? (
          <Badge variant={stale ? "warning" : "success"}>
            {stale ? "Stale" : `Version ${artifact.version}`}
          </Badge>
        ) : (
          <Badge variant="ghost">Not generated</Badge>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {stale ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>This was generated from an older scope version</AlertTitle>
            <AlertDescription>
              {artifact?.stale_reasons?.length
                ? artifact.stale_reasons.join(" ")
                : "Something it depends on changed."}{" "}
              Regenerate it so the package stays consistent.
            </AlertDescription>
          </Alert>
        ) : null}
        <StageButton
          running={generate.isPending}
          stage={`Generating the ${title.toLowerCase()}`}
          disabled={Boolean(blockedReason)}
          variant={artifact ? "outline" : "default"}
          onClick={() => generate.mutate({ kind, options })}
        >
          {artifact ? (
            <RefreshCwIcon data-icon="inline-start" />
          ) : (
            <PlayIcon data-icon="inline-start" />
          )}
          {artifact ? "Regenerate" : title}
        </StageButton>
        {blockedReason ? <p className="text-sm text-muted-foreground">{blockedReason}</p> : null}
        {generate.isError ? <ErrorState error={generate.error} /> : null}
        {generate.data?.mock_notice ? (
          <Alert>
            <AlertDescription>{generate.data.mock_notice}</AlertDescription>
          </Alert>
        ) : null}
        <FindingsNotice findings={generate.data?.warnings ?? []} />
        {children}
      </div>
    </SectionCard>
  )
}
