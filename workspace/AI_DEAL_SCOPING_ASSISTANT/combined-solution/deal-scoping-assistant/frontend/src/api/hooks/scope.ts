import { useMutation, useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import { invalidatedBy, queryKeys } from "@/api/queryKeys"
import { sessionPath, useInvalidate } from "@/api/hooks/shared"
import type { QueryHookOptions } from "@/api/hooks/shared"
import type { ScopeItem, ScopeItemCreate, ScopeItemUpdate, ScopeView } from "@/api/types"

function scopePath(sessionId: string, suffix = ""): string {
  return sessionPath(sessionId, `/scope${suffix}`)
}

function itemPath(sessionId: string, itemId: string): string {
  return scopePath(sessionId, `/items/${encodeURIComponent(itemId)}`)
}

export function useScope(sessionId: string, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: queryKeys.scope(sessionId),
    queryFn: () => api.get<ScopeView>(scopePath(sessionId)),
    enabled: options.enabled ?? Boolean(sessionId),
  })
}

export function useCreateScopeItem(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Scope item added" },
    mutationFn: (payload: ScopeItemCreate) =>
      api.post<ScopeItem>(scopePath(sessionId, "/items"), payload),
    onSuccess: () => invalidate(invalidatedBy.scopeEdit(sessionId)),
  })
}

export interface ScopeItemEdit {
  itemId: string
  payload: ScopeItemUpdate
}

export function useUpdateScopeItem(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Scope item saved" },
    mutationFn: ({ itemId, payload }: ScopeItemEdit) =>
      api.patch<ScopeItem>(itemPath(sessionId, itemId), payload),
    onSuccess: () => invalidate(invalidatedBy.scopeEdit(sessionId)),
  })
}

export function useDeleteScopeItem(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Scope item removed" },
    mutationFn: (itemId: string) => api.delete<void>(itemPath(sessionId, itemId)),
    onSuccess: () => invalidate(invalidatedBy.scopeEdit(sessionId)),
  })
}

export interface QuestionAnswerInput {
  itemId: string
  answer: string
}

export function useAnswerQuestion(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Answer saved" },
    mutationFn: ({ itemId, answer }: QuestionAnswerInput) =>
      api.post<ScopeItem>(scopePath(sessionId, `/questions/${encodeURIComponent(itemId)}/answer`), {
        answer,
      }),
    onSuccess: () => invalidate(invalidatedBy.scopeEdit(sessionId)),
  })
}

export interface AssumptionDecision {
  itemId: string
  confirmed: boolean
}

export function useDecideAssumption(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Assumption decision saved" },
    mutationFn: ({ itemId, confirmed }: AssumptionDecision) =>
      api.post<ScopeItem>(
        scopePath(
          sessionId,
          `/assumptions/${encodeURIComponent(itemId)}/${confirmed ? "confirm" : "reject"}`,
        ),
      ),
    onSuccess: () => invalidate(invalidatedBy.scopeEdit(sessionId)),
  })
}

/** Approving locks the scope: later edits must go through the change service (409 otherwise). */
export function useApproveScope(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Scope approved" },
    mutationFn: () => api.post<ScopeView>(scopePath(sessionId, "/approve")),
    onSuccess: () => invalidate(invalidatedBy.scopeApproval(sessionId)),
  })
}
