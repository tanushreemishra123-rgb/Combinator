/**
 * Deep-linking for structured ids shown anywhere in this workspace. Every id chip - a requirement
 * id in the traceability table, a component id in a quality finding, a driver id in the change log
 * - should open the workspace that owns it (spec: "Clicking an ID chip navigates to the requirement
 * in the Customer Requirements Workspace"; the Quality Gate additionally deep-links to "the relevant
 * workspace" for ids that are not requirements). Requirement-kind prefixes (FR, NFR, INT, ...) and
 * any id this map does not recognise both resolve to the Customer Requirements Workspace.
 */
import { useCallback } from 'react';
import type { TraceTargetType } from '../../domain';
import { useWorkspaceNavigation } from '../navigation';
import type { WorkspaceId } from '../navigation';

const PREFIX_WORKSPACE: ReadonlyMap<string, WorkspaceId> = new Map([
  ['CAP', 'prd'],
  ['JNY', 'prd'],
  ['ENH', 'prd'],
  ['ARC', 'architecture'],
  ['DD', 'strategy'],
  ['IF', 'strategy'],
  ['AIUC', 'strategy'],
  ['WS', 'estimate'],
  ['DRV', 'estimate'],
]);

function prefixOf(ref: string): string {
  return /^([A-Z]+)_/.exec(ref)?.at(1) ?? '';
}

/** Workspace that owns the generated element named by a structured id. */
export function workspaceForRef(ref: string): WorkspaceId {
  return PREFIX_WORKSPACE.get(prefixOf(ref)) ?? 'requirements';
}

/** Stable callback that deep-links any id chip to the workspace that owns it. */
export function useRefNavigation(): (ref: string) => void {
  const navigation = useWorkspaceNavigation();
  return useCallback((ref: string) => navigation.navigate(workspaceForRef(ref), ref), [navigation]);
}

const TARGET_TYPE_LABELS: ReadonlyMap<TraceTargetType, string> = new Map([
  ['capability', 'Capability'],
  ['component', 'Architecture component'],
  ['dataDomain', 'Data domain'],
  ['dataTopic', 'Data topic'],
  ['integration', 'Integration'],
  ['aiUseCase', 'AI use case'],
  ['framework', 'Framework recommendation'],
  ['workstream', 'Workstream'],
  ['journey', 'User journey'],
]);

/** Human noun for a traceability target type, e.g. in "Architecture component "API Gateway" cites...". */
export function targetTypeLabel(targetType: TraceTargetType): string {
  return TARGET_TYPE_LABELS.get(targetType) ?? 'Generated element';
}
