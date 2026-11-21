import type { CloudPlatform, GenerateOptions, Session } from "@/api/types"

/** "recommend" asks the assistant to pick the platform instead of naming one. */
export type PlatformChoice = CloudPlatform | "recommend"

export const PLATFORMS: readonly CloudPlatform[] = ["aws", "azure", "gcp"]

export type PlatformMode =
  /** Not approved yet: the choice is saved straight onto the session. */
  | "session"
  /** Approved but no platform yet: the backend only accepts it with the generate call. */
  | "generate"
  /** Approved with a platform: swapping it has to be recorded with its impact. */
  | "change_request"

export interface PlatformSelectorState {
  mode: PlatformMode
  selected: PlatformChoice | null
  /** Shown next to the selector when the plain path is closed. */
  note: string | null
}

export function platformSelectorState(
  session: Pick<Session, "cloud_platform" | "platform_mode" | "scope_status">,
): PlatformSelectorState {
  const selected: PlatformChoice | null =
    session.cloud_platform ?? (session.platform_mode === "recommended" ? "recommend" : null)

  if (session.scope_status !== "approved") {
    return { mode: "session", selected, note: null }
  }
  if (!session.cloud_platform) {
    return {
      mode: "generate",
      selected,
      note: "The scope is approved, so the platform is set by the first architecture generation.",
    }
  }
  return {
    mode: "change_request",
    selected,
    note: "This session already designs for a platform. Swapping it changes the architecture, the strategies and the estimate, so it goes through a recorded change.",
  }
}

/**
 * What to send with the generate call. Once the session has a platform it is the only
 * thing sent: a stale "recommend" choice would be refused, since a new recommendation
 * could swap the platform without a recorded change. Before that, the choice is passed
 * as made and the first generation sets the platform.
 */
export function platformGenerateOptions(
  choice: PlatformChoice | null,
  current: CloudPlatform | null,
): GenerateOptions {
  if (current) return { platform: current, recommend: false }
  if (choice === "recommend") return { recommend: true }
  if (choice) return { platform: choice, recommend: false }
  return { recommend: false }
}
