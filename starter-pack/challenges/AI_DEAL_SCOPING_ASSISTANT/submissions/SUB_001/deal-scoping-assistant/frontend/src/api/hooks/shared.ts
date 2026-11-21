import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { QueryKey } from "@tanstack/react-query"

export const V1 = "/api/v1"

/** Ids come from the URL, so they are escaped before they go back into a path. */
export function sessionPath(sessionId: string, suffix = ""): string {
  return `${V1}/sessions/${encodeURIComponent(sessionId)}${suffix}`
}

/** Options every query hook accepts, so a caller can wait for a route param. */
export interface QueryHookOptions {
  enabled?: boolean
}

/** Refetches the keys a mutation invalidates; the caller lists them explicitly. */
export function useInvalidate(): (keys: readonly QueryKey[]) => Promise<void> {
  const client = useQueryClient()
  return useCallback(
    async (keys) => {
      await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })))
    },
    [client],
  )
}
