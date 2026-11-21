/** Changes to a reviewer's manual complexity settings on estimate drivers. */
import type { ChangeDescriptor, Complexity, DriverSuggestion, EstimateBundle } from '../../domain';
import { quote, unique } from '../format';

function driversOf(bundle: EstimateBundle): DriverSuggestion[] {
  return bundle.suggestion.workstreams.flatMap((workstream) => workstream.drivers);
}

/** Complexity the engine uses for a driver: the reviewer's override, else the AI suggestion. */
function effectiveComplexity(bundle: EstimateBundle, driverId: string): Complexity | undefined {
  const override = bundle.overrides.find((entry) => entry.driverId === driverId);
  return override?.complexity ?? driversOf(bundle).find((driver) => driver.id === driverId)?.complexity;
}

function describeOverrideChange(before: EstimateBundle, after: EstimateBundle, driverId: string): ChangeDescriptor[] {
  const from = effectiveComplexity(before, driverId);
  const to = effectiveComplexity(after, driverId);
  const driver = driversOf(after).find((candidate) => candidate.id === driverId) ?? driversOf(before).find((candidate) => candidate.id === driverId);
  if (driver === undefined || from === undefined || to === undefined || from === to) {
    return [];
  }
  const isIntegration = driver.type === 'integration';
  const subject = isIntegration ? 'Integration complexity' : 'Complexity';
  return [
    {
      kind: isIntegration ? 'integration-complexity' : 'driver-complexity',
      targetId: driverId,
      label: `${subject} of estimate driver ${driverId} ${quote(driver.label)} changed from ${from} to ${to}`,
      from,
      to,
    },
  ];
}

/** Only drivers with an override in either snapshot are compared, so a regenerated suggestion is not reported as an edit. */
export function describeComplexityChanges(before: EstimateBundle | null, after: EstimateBundle | null): ChangeDescriptor[] {
  if (before === null || after === null) {
    return [];
  }
  const driverIds = unique([...before.overrides, ...after.overrides].map((override) => override.driverId));
  return driverIds.flatMap((driverId) => describeOverrideChange(before, after, driverId));
}
