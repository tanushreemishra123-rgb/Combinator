import { useMutation, useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import { invalidatedBy, queryKeys } from "@/api/queryKeys"
import { sessionPath, useInvalidate, V1 } from "@/api/hooks/shared"
import type { QueryHookOptions } from "@/api/hooks/shared"
import type { Session, SessionCreate, SessionUpdate } from "@/api/types"

export function useSessions() {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: () => api.get<Session[]>(`${V1}/sessions`),
  })
}

export function useSession(sessionId: string, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: queryKeys.session(sessionId),
    queryFn: () => api.get<Session>(sessionPath(sessionId)),
    enabled: options.enabled ?? Boolean(sessionId),
  })
}

export function useCreateSession() {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Session created" },
    mutationFn: (payload: SessionCreate) => api.post<Session>(`${V1}/sessions`, payload),
    onSuccess: (session) => invalidate(invalidatedBy.sessionWrite(session.id)),
  })
}

export function useUpdateSession(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Session saved" },
    mutationFn: (payload: SessionUpdate) => api.patch<Session>(sessionPath(sessionId), payload),
    onSuccess: () => invalidate(invalidatedBy.sessionWrite(sessionId)),
  })
}

export function useDeleteSession() {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Session deleted" },
    mutationFn: (sessionId: string) => api.delete<void>(sessionPath(sessionId)),
    onSuccess: (_result, sessionId) => invalidate(invalidatedBy.sessionWrite(sessionId)),
  })
}
