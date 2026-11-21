import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import { queryKeys } from "@/api/queryKeys"
import { sessionPath } from "@/api/hooks/shared"
import type { QueryHookOptions } from "@/api/hooks/shared"
import type { CoverageReport } from "@/api/types"

/** Coverage is computed from the stored artifacts, so it is a read, never a generation. */
export function useCoverage(sessionId: string, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: queryKeys.coverage(sessionId),
    queryFn: () => api.get<CoverageReport>(sessionPath(sessionId, "/coverage")),
    enabled: options.enabled ?? Boolean(sessionId),
  })
}
