/**
 * Maps each of the six recommended application sections (spec "Recommended Application Sections")
 * to its root component, imported by contract name from that workspace's `index.ts`. A `Map`
 * lookup keeps this a single data table instead of a `switch` or dynamic property access.
 */
import type { ComponentType } from 'react';
import { ArchitectureWorkspace } from '../ui/architecture';
import { EstimateWorkspace } from '../ui/estimate';
import { WORKSPACE_META } from '../ui/shell';
import type { WorkspaceMeta } from '../ui/shell';
import type { WorkspaceId } from '../ui/navigation';
import { PackageWorkspace } from '../ui/package';
import { PrdWorkspace } from '../ui/prd';
import { RequirementsWorkspace } from '../ui/requirements';
import { StrategyWorkspace } from '../ui/strategy';

export interface WorkspaceRegistryEntry extends WorkspaceMeta {
  Component: ComponentType;
}

const WORKSPACE_COMPONENTS: ReadonlyMap<WorkspaceId, ComponentType> = new Map<WorkspaceId, ComponentType>([
  ['requirements', RequirementsWorkspace],
  ['prd', PrdWorkspace],
  ['architecture', ArchitectureWorkspace],
  ['strategy', StrategyWorkspace],
  ['estimate', EstimateWorkspace],
  ['package', PackageWorkspace],
]);

function resolveComponent(id: WorkspaceId): ComponentType {
  const Component = WORKSPACE_COMPONENTS.get(id);
  if (Component === undefined) {
    throw new Error(`No workspace component is registered for "${id}".`);
  }
  return Component;
}

/** In journey order (spec "Core User Journey"), matching `WORKSPACE_META`. */
const REGISTRY: readonly WorkspaceRegistryEntry[] = WORKSPACE_META.map((meta) => ({ ...meta, Component: resolveComponent(meta.id) }));

const REGISTRY_BY_ID: ReadonlyMap<WorkspaceId, WorkspaceRegistryEntry> = new Map(REGISTRY.map((entry) => [entry.id, entry]));

export function workspaceRegistryEntries(): readonly WorkspaceRegistryEntry[] {
  return REGISTRY;
}

export function getWorkspaceEntry(id: WorkspaceId): WorkspaceRegistryEntry | undefined {
  return REGISTRY_BY_ID.get(id);
}
