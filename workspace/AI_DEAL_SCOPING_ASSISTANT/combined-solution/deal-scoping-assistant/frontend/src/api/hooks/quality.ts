import { useMutation, useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import { invalidatedBy, queryKeys } from "@/api/queryKeys"
import { sessionPath, useInvalidate } from "@/api/hooks/shared"
import type { QueryHookOptions } from "@/api/hooks/shared"
import type { QualityReport } from "@/api/types"

export function useQualityReport(sessionId: string, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: queryKeys.quality(sessionId),
    queryFn: () => api.get<QualityReport>(sessionPath(sessionId, "/quality-gate")),
    enabled: options.enabled ?? Boolean(sessionId),
  })
}

export function useRunQualityGate(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Quality gate run" },
    mutationFn: () => api.post<QualityReport>(sessionPath(sessionId, "/quality-gate/run")),
    onSuccess: () => invalidate(invalidatedBy.qualityRun(sessionId)),
  })
}
