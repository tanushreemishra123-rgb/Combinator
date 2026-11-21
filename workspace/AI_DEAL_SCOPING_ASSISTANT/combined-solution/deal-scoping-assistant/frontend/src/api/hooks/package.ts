import { useMutation, useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import { invalidatedBy, queryKeys } from "@/api/queryKeys"
import { sessionPath, useInvalidate } from "@/api/hooks/shared"
import type { QueryHookOptions } from "@/api/hooks/shared"
import type { DownloadedFile } from "@/api/client"
import type { DocumentModel, ExportRequest } from "@/api/types"

export function usePackageDocument(sessionId: string, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: queryKeys.packageDocument(sessionId),
    queryFn: () => api.get<DocumentModel>(sessionPath(sessionId, "/package")),
    enabled: options.enabled ?? Boolean(sessionId),
  })
}

export function useBuildPackage(sessionId: string) {
  const invalidate = useInvalidate()
  return useMutation({
    meta: { success: "Package built" },
    mutationFn: () => api.post<DocumentModel>(sessionPath(sessionId, "/package/build")),
    onSuccess: () => invalidate(invalidatedBy.packageBuild(sessionId)),
  })
}

/** Returns the file itself; the caller decides how to hand it to the browser. */
export function useExportPackage(sessionId: string) {
  return useMutation<DownloadedFile, Error, ExportRequest>({
    meta: { success: "Package exported" },
    mutationFn: (payload) =>
      api.download("POST", sessionPath(sessionId, "/package/export"), payload, {
        fallbackFilename: `scoping-package.${payload.format}`,
      }),
  })
}
