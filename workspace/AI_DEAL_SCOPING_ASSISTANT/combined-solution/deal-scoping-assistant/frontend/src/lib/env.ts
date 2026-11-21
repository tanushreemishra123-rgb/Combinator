import { z } from "zod"

// The frontend never holds secrets: the backend origin is the only variable it needs.
const envSchema = z.object({
  VITE_API_BASE_URL: z.url({
    protocol: /^https?$/,
    error: "VITE_API_BASE_URL must be an absolute http(s) URL, for example http://localhost:8000",
  }),
})

export type Env = z.infer<typeof envSchema>

// Pure so the failure message can be asserted in tests without touching import.meta.
export function parseEnv(raw: unknown): Env {
  const result = envSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(`Invalid frontend environment.\n${z.prettifyError(result.error)}`)
  }
  // Strip the trailing slash once so request paths can always start with "/".
  return { VITE_API_BASE_URL: result.data.VITE_API_BASE_URL.replace(/\/+$/, "") }
}

// Read once at module load so a misconfigured deployment fails immediately.
export const env = parseEnv(import.meta.env)
