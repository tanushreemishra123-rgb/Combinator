import { useMutation, useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import { invalidatedBy, queryKeys } from "@/api/queryKeys"
import { sessionPath, useInvalidate, V1 } from "@/api/hooks/shared"
import type { QueryHookOptions } from "@/api/hooks/shared"
import type {
  Estimate,
  EstimationConfig,
  HistoricalProjects,
  RateCard,
  SessionConfigInput,
} from "@/api/types"

export function useRateCards() {
  return useQuery({
    queryKey: queryKeys.rateCards,
    queryFn: () => api.get<RateCard[]>(`${V1}/rate-cards`),
    staleTime: Infinity,
  })
}

/** Reference only: these numbers never enter the calculation. */
export function useHistoricalProjects() {
  return useQuery({
    queryKey: queryKeys.historicalProjects,
    queryFn: () => api.get<HistoricalProjects>(`${V1}/estimate/historical-projects`),
    staleTime: Infinity,
  })
}

export function useEstimationConfig(sessionId: string, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: queryKeys.estimationConfig(sessionId),
    queryFn: () => api.get<EstimationConfig>(sessionPath(sessionId, "/estimation-config")),
    enabled: options.enabled ?? Boolean(sessionId),
  })
}

export function useSaveEstimationConfig(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Estimation inputs saved" },
    mutationFn: (payload: SessionConfigInput) =>
      api.put<EstimationConfig>(sessionPath(sessionId, "/estimation-config"), payload),
    onSuccess: () =>
      invalidate([...invalidatedBy.estimateWrite(sessionId), queryKeys.session(sessionId)]),
  })
}

export function useEstimate(sessionId: string, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: queryKeys.estimate(sessionId),
    queryFn: () => api.get<Estimate>(sessionPath(sessionId, "/estimate")),
    enabled: options.enabled ?? Boolean(sessionId),
  })
}

export function useCalculateEstimate(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Estimate recalculated" },
    mutationFn: () => api.post<Estimate>(sessionPath(sessionId, "/estimate/calculate")),
    onSuccess: () => invalidate(invalidatedBy.estimateWrite(sessionId)),
  })
}
