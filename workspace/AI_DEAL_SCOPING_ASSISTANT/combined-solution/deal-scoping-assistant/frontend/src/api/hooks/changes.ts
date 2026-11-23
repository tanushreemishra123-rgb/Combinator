import { useMutation, useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import { invalidatedBy, queryKeys } from "@/api/queryKeys"
import { sessionPath, useInvalidate } from "@/api/hooks/shared"
import type { QueryHookOptions } from "@/api/hooks/shared"
import type { ChangeRecord, ChangeRequest, RegenerationResult } from "@/api/types"

function changesPath(sessionId: string, suffix = ""): string {
  return sessionPath(sessionId, `/changes${suffix}`)
}

export function useChanges(sessionId: string, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: queryKeys.changes(sessionId),
    queryFn: () => api.get<ChangeRecord[]>(changesPath(sessionId)),
    enabled: options.enabled ?? Boolean(sessionId),
  })
}

/** After approval every edit is recorded here; the record carries the impact. */
export function useRecordChange(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Change recorded and affected outputs marked" },
    mutationFn: (payload: ChangeRequest) => api.post<ChangeRecord>(changesPath(sessionId), payload),
    onSuccess: () => invalidate(invalidatedBy.change(sessionId)),
  })
}

export function useRegenerateAfterChange(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Affected outputs regenerated" },
    mutationFn: (changeId: string) =>
      api.post<RegenerationResult>(
        changesPath(sessionId, `/${encodeURIComponent(changeId)}/regenerate`),
      ),
    onSuccess: () => invalidate(invalidatedBy.change(sessionId)),
  })
}
