/**
 * Change detection (spec: "modify at least one reviewed requirement, assumption, or
 * configuration"). Compares two session snapshots and lists every difference that can influence a
 * generated deliverable, each as one `ChangeDescriptor` with a readable label and from/to values.
 */
import type { ChangeDescriptor, ScopingSession } from '../domain';
import { describeCommercialChanges } from './changes/commercialChanges';
import { describeComplexityChanges } from './changes/complexityChanges';
import { describeConfigChanges } from './changes/configChanges';
import { describeScopeChanges } from './changes/scopeChanges';

/** Compares two session snapshots and lists every reviewed requirement/assumption/config change. */
export function describeChanges(before: ScopingSession, after: ScopingSession): ChangeDescriptor[] {
  return [
    ...describeConfigChanges(before.config, after.config),
    ...describeCommercialChanges(before.estimationConfig, after.estimationConfig),
    ...describeScopeChanges(before.scope, after.scope),
    ...describeComplexityChanges(before.outputs.estimate.data, after.outputs.estimate.data),
  ];
}
