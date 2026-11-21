import type { ArchitectureComponent } from "@/api/types"

export interface TraceRow {
  requirementId: string
  componentIds: string[]
}

/** Requirement to components, built from what each component says it supports. */
export function requirementTrace(components: readonly ArchitectureComponent[]): TraceRow[] {
  const byRequirement = new Map<string, string[]>()
  for (const component of components) {
    for (const requirementId of component.supported_ids) {
      const existing = byRequirement.get(requirementId)
      if (existing) existing.push(component.id)
      else byRequirement.set(requirementId, [component.id])
    }
  }
  return [...byRequirement.entries()]
    .map(([requirementId, componentIds]) => ({ requirementId, componentIds }))
    .sort((left, right) => left.requirementId.localeCompare(right.requirementId))
}
