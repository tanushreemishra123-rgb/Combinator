import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import { queryKeys } from "@/api/queryKeys"
import { V1 } from "@/api/hooks/shared"
import type { Health, SystemInfo } from "@/api/types"

/** AI mode, provider and model. It only changes when the backend restarts. */
export function useSystemInfo() {
  return useQuery({
    queryKey: queryKeys.system,
    queryFn: () => api.get<SystemInfo>(`${V1}/system`),
    staleTime: Infinity,
  })
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.get<Health>(`${V1}/health`),
  })
}
