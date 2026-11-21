import { describe, expect, it } from 'vitest';
import { createDefaultEstimationConfig } from '../../../seed';
import { withBaseEffortValue, withPhaseOverheadPct } from './configEdits';

describe('withBaseEffortValue', () => {
  it('replaces only the targeted driver type and complexity cell', () => {
    const config = createDefaultEstimationConfig();
    const updated = withBaseEffortValue(config.baseEffort, 'integration', 'High', 99);
    const integrationRow = updated.find((row) => row.driverType === 'integration');
    expect(integrationRow?.days.find((cell) => cell.complexity === 'High')?.value).toBe(99);
    expect(integrationRow?.days.find((cell) => cell.complexity === 'Low')?.value).toBe(6);
  });

  it('leaves every other driver type row untouched', () => {
    const config = createDefaultEstimationConfig();
    const updated = withBaseEffortValue(config.baseEffort, 'data', 'Medium', 50);
    const capabilityRow = updated.find((row) => row.driverType === 'capability');
    expect(capabilityRow).toEqual(config.baseEffort.find((row) => row.driverType === 'capability'));
  });
});

describe('withPhaseOverheadPct', () => {
  it('replaces the named phase percentage', () => {
    const config = createDefaultEstimationConfig();
    const updated = withPhaseOverheadPct(config.phaseOverheads, 'PH_5', 30);
    expect(updated.find((row) => row.phaseId === 'PH_5')?.pctOfBuild).toBe(30);
  });

  it('leaves phases that do not match untouched', () => {
    const config = createDefaultEstimationConfig();
    const updated = withPhaseOverheadPct(config.phaseOverheads, 'PH_5', 30);
    expect(updated.find((row) => row.phaseId === 'PH_1')).toEqual(config.phaseOverheads.find((row) => row.phaseId === 'PH_1'));
  });
});
