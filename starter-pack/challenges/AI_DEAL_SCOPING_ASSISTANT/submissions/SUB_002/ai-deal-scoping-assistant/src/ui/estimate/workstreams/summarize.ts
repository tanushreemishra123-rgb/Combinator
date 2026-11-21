/** Turns a workstream's drivers into the short prose the spec's example format calls "Estimate Drivers". */
import type { EstimateDriver } from '../../../domain';
import { joinList } from '../format';

export function summarizeDrivers(drivers: readonly EstimateDriver[]): string {
  if (drivers.length === 0) {
    return 'No estimate drivers yet.';
  }
  return joinList(drivers.map((driver) => driver.label));
}
