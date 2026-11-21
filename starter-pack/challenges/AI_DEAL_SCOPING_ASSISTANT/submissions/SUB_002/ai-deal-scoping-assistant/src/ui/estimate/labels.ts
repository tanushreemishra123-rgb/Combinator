/**
 * Small display-only vocabulary the Estimate Workspace needs but the (finished) estimation engine
 * only uses internally for its own calculation trace text. Kept to the same wording as that trace
 * (see `src/estimation/engine/drivers.ts`) so a driver reads identically here and in its
 * step-by-step "Calculation" list.
 */
import type { Complexity, DriverType } from '../../domain';

export const COMPLEXITY_OPTIONS: readonly Complexity[] = ['Low', 'Medium', 'High', 'Very High'];

const DRIVER_TYPE_LABELS: ReadonlyMap<DriverType, string> = new Map([
  ['capability', 'Capability'],
  ['integration', 'Integration'],
  ['data', 'Data'],
  ['ai', 'AI use case'],
  ['security', 'Security control'],
  ['infrastructure', 'Infrastructure'],
  ['nonFunctional', 'Non-functional hardening'],
]);

export function driverTypeLabel(type: DriverType): string {
  return DRIVER_TYPE_LABELS.get(type) ?? type;
}

/** Role mix rows also carry an 'overhead' pseudo-type for the discovery/testing/deployment phases. */
export function mixRowLabel(type: DriverType | 'overhead'): string {
  return type === 'overhead' ? 'Overhead phases' : driverTypeLabel(type);
}
