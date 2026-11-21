import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { api } from "@/api/client"
import { invalidatedBy, queryKeys } from "@/api/queryKeys"
import { sessionPath, useInvalidate } from "@/api/hooks/shared"
import type { QueryHookOptions } from "@/api/hooks/shared"
import { label } from "@/lib/labels"
import type { Artifact, ArtifactKind, GenerateOptions, GenerateResult } from "@/api/types"

function artifactsPath(sessionId: string, suffix = ""): string {
  return sessionPath(sessionId, `/artifacts${suffix}`)
}

/** Every stored artifact, used for step statuses and stale badges. */
export function useArtifacts(sessionId: string, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: queryKeys.artifacts(sessionId),
    queryFn: () => api.get<Artifact[]>(artifactsPath(sessionId)),
    enabled: options.enabled ?? Boolean(sessionId),
  })
}

/** Picks one kind out of the list with its content narrowed. */
export function artifactOf<K extends ArtifactKind>(
  artifacts: readonly Artifact[] | undefined,
  kind: K,
): Artifact<K> | undefined {
  return artifacts?.find((artifact): artifact is Artifact<K> => artifact.kind === kind)
}

/** Reads one artifact directly; the backend answers 404 until it has been generated. */
export function useArtifact<K extends ArtifactKind>(
  sessionId: string,
  kind: K,
  options: QueryHookOptions = {},
) {
  return useQuery({
    queryKey: queryKeys.artifact(sessionId, kind),
    queryFn: () => api.get<Artifact<K>>(artifactsPath(sessionId, `/${kind}`)),
    enabled: options.enabled ?? Boolean(sessionId),
  })
}

// The body is required, and the backend's own default is "design for the selected platform".
const DEFAULT_GENERATE_OPTIONS: GenerateOptions = { recommend: false }

export interface GenerateInput {
  kind: ArtifactKind
  options?: GenerateOptions
}

export function useGenerateArtifact(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ kind, options }: GenerateInput) =>
      api.post<GenerateResult>(
        artifactsPath(sessionId, `/${kind}/generate`),
        options ?? DEFAULT_GENERATE_OPTIONS,
      ),
    onSuccess: (_result, { kind }) => {
      invalidate(invalidatedBy.generation(sessionId))
      toast.success(`${label(kind)} generated`)
    },
  })
}
