import { useMutation, useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import { invalidatedBy, queryKeys } from "@/api/queryKeys"
import { useInvalidate, V1 } from "@/api/hooks/shared"
import type { Scenario, Session } from "@/api/types"

/** Seeded scenarios offered on the sessions home. */
export function useScenarios() {
  return useQuery({
    queryKey: queryKeys.scenarios,
    queryFn: () => api.get<Scenario[]>(`${V1}/scenarios`),
    staleTime: Infinity,
  })
}

export function useCreateSessionFromScenario() {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Session created from the scenario" },
    mutationFn: (slug: string) =>
      api.post<Session>(`${V1}/sessions/from-scenario/${encodeURIComponent(slug)}`),
    onSuccess: (session) => invalidate(invalidatedBy.sessionWrite(session.id)),
  })
}
