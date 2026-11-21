import type { CloudPlatform, ProviderOption } from "@/api/types"

/**
 * Options are recorded for every platform plus "any"; the workspace shows the ones that
 * apply to the platform this session designs for.
 */
export function providersForPlatform(
  options: readonly ProviderOption[],
  platform: CloudPlatform | null,
): ProviderOption[] {
  if (!platform) return [...options]
  return options.filter((option) => option.platform === platform || option.platform === "any")
}
