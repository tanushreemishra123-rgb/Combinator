import { useMutation } from "@tanstack/react-query"
import { api } from "@/api/client"
import { invalidatedBy } from "@/api/queryKeys"
import { sessionPath, useInvalidate } from "@/api/hooks/shared"
import type { AnalysisResult } from "@/api/types"

/** Synchronous stage: it can take up to two minutes in live mode. */
export function useRunAnalysis(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Requirements analysed" },
    mutationFn: () => api.post<AnalysisResult>(sessionPath(sessionId, "/analysis")),
    onSuccess: () => invalidate(invalidatedBy.analysis(sessionId)),
  })
}
