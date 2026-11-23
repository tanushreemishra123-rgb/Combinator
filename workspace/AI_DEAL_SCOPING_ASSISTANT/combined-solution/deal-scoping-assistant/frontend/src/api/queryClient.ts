import { MutationCache, QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ApiError } from "@/api/client"

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** Shown as a notification when the mutation succeeds. */
      success?: string
    }
  }
}

// A 4xx is a client mistake: retrying it only delays the error the user needs to see.
function retry(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  return failureCount < 2
}

export const queryClient = new QueryClient({
  // One place tells the user an action went through; each mutation names it in `meta`.
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      const message = mutation.meta?.success
      if (message) toast.success(message)
    },
  }),
  defaultOptions: {
    queries: {
      retry,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
})
