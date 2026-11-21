import type { SystemInfo } from "@/api/types"

/** Why the app is in mock mode although live was configured. */
export function fallbackNotice(system: SystemInfo): string | null {
  if (system.ai_mode === "live" || !system.fallback_reason) return null
  return `Live AI is unavailable: ${system.fallback_reason}`
}

export function aiTarget(system: SystemInfo): string {
  return [system.provider, system.model].filter(Boolean).join(" / ")
}

export function aiModeLabel(system: SystemInfo): string {
  if (system.ai_mode !== "live") return "Mock (recorded responses)"
  const target = aiTarget(system)
  return target ? `Live — ${target}` : "Live"
}
