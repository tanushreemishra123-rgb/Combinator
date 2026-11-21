/** Local tab ids for this workspace (not part of the state-layer navigation contract). */
export const ARCHITECTURE_TAB_IDS = ['diagram', 'components', 'security', 'traceability'] as const;

export type ArchitectureTabId = (typeof ARCHITECTURE_TAB_IDS)[number];

export function isArchitectureTabId(value: string): value is ArchitectureTabId {
  return (ARCHITECTURE_TAB_IDS as readonly string[]).includes(value);
}
