import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import { queryKeys } from "@/api/queryKeys"
import { sessionPath } from "@/api/hooks/shared"
import type { QueryHookOptions } from "@/api/hooks/shared"
import type { Diagrams } from "@/api/types"

/** Mermaid sources; the browser renders them and sends PNGs back for the export. */
export function useDiagrams(sessionId: string, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: queryKeys.diagrams(sessionId),
    queryFn: () => api.get<Diagrams>(sessionPath(sessionId, "/diagrams")),
    enabled: options.enabled ?? Boolean(sessionId),
  })
}
