import { useMutation, useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import { invalidatedBy, queryKeys } from "@/api/queryKeys"
import { sessionPath, useInvalidate } from "@/api/hooks/shared"
import type { QueryHookOptions } from "@/api/hooks/shared"
import type { DocumentSummary, SourceDocument } from "@/api/types"

function documentsPath(sessionId: string, documentId?: string): string {
  const suffix = documentId ? `/documents/${encodeURIComponent(documentId)}` : "/documents"
  return sessionPath(sessionId, suffix)
}

export function useDocuments(sessionId: string, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: queryKeys.documents(sessionId),
    queryFn: () => api.get<DocumentSummary[]>(documentsPath(sessionId)),
    enabled: options.enabled ?? Boolean(sessionId),
  })
}

/** The full document, including its normalized text and segments. */
export function useDocument(
  sessionId: string,
  documentId: string | undefined,
  options: QueryHookOptions = {},
) {
  return useQuery({
    queryKey: queryKeys.document(sessionId, documentId ?? ""),
    queryFn: () => api.get<SourceDocument>(documentsPath(sessionId, documentId ?? "")),
    enabled: options.enabled ?? Boolean(sessionId && documentId),
  })
}

export interface PastedDocument {
  name: string
  text: string
}

export function useAddPastedDocument(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Requirements added" },
    mutationFn: (payload: PastedDocument) =>
      api.post<SourceDocument>(documentsPath(sessionId), payload),
    onSuccess: () => invalidate(invalidatedBy.documentWrite(sessionId)),
  })
}

export function useUploadDocument(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Document uploaded" },
    mutationFn: (file: File) => {
      // FormData is sent as-is so the browser sets the multipart boundary.
      const body = new FormData()
      body.append("file", file)
      return api.post<SourceDocument>(documentsPath(sessionId), body)
    },
    onSuccess: () => invalidate(invalidatedBy.documentWrite(sessionId)),
  })
}

export function useDeleteDocument(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Document removed" },
    mutationFn: (documentId: string) => api.delete<void>(documentsPath(sessionId, documentId)),
    onSuccess: () => invalidate(invalidatedBy.documentWrite(sessionId)),
  })
}
