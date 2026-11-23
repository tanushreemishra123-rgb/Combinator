import type { ArchitectureComponent } from "@/api/types"

/**
 * The strategies stay platform-neutral and only cite ARC ids, so the cloud service names
 * are resolved from whichever architecture the session currently has.
 */
export function serviceNames(
  components: readonly ArchitectureComponent[] | undefined,
  arcIds: readonly string[],
): string[] {
  if (!components) return []
  const byId = new Map(components.map((component) => [component.id, component]))
  const names: string[] = []
  for (const arcId of arcIds) {
    const service = byId.get(arcId)?.cloud_service
    if (service && !names.includes(service)) names.push(service)
  }
  return names
}
