import { driver, suggestionOf, workstream } from '../testing/estimateFixtures';
import { estimateContext } from '../testing/estimateFixtures';
import { findDoubleCountedDrivers, reconcileCapabilityWorkstreams, securityModelFor } from './doubleCounting';
import { createPlannerFacts } from './facts';
import type { DriverSeed, WorkstreamSeed } from './facts';

function seed(name: string, drivers: DriverSeed[]): WorkstreamSeed {
  return { name, phaseId: 'PH_2', drivers, skills: [] };
}

function seedDriver(label: string, refIds: string[]): DriverSeed {
  return { type: 'capability', label, complexity: 'Medium', rationale: `${label} rationale for the test.`, refIds };
}

describe('securityModelFor', () => {
  it('is capability-led once a capability workstream is named for security', () => {
    expect(securityModelFor([seed('Security Controls', [])])).toBe('capability-led');
    expect(securityModelFor([seed('Member Experience', [])])).toBe('generic');
    expect(securityModelFor([])).toBe('generic');
  });
});

describe('reconcileCapabilityWorkstreams', () => {
  const facts = createPlannerFacts(estimateContext());

  it('drops a capability driver once an AI-use-case driver already prices its requirements (rule 1)', () => {
    const capabilityWorkstreams = [seed('AI Capabilities', [seedDriver('AI policy assistant', ['CAP_03', 'FR_03'])])];
    const ai = [seedDriver('Policy question answering', ['AIUC_01', 'FR_03'])];
    const reconciled = reconcileCapabilityWorkstreams(capabilityWorkstreams, { ai, integration: [], data: [] }, facts);
    expect(reconciled.flatMap((ws) => ws.drivers)).toEqual([]);
  });

  it('drops a capability driver once an integration-interface driver already prices its requirements (rule 4)', () => {
    const capabilityWorkstreams = [seed('Integration Layer', [seedDriver('CRM Integration', ['CAP_21', 'INT_01'])])];
    const integration = [seedDriver('Salesforce CRM profile sync', ['IS_01', 'INT_01', 'ARC_03'])];
    const reconciled = reconcileCapabilityWorkstreams(capabilityWorkstreams, { ai: [], integration, data: [] }, facts);
    expect(reconciled.flatMap((ws) => ws.drivers)).toEqual([]);
  });

  it('drops a capability driver once a data driver already prices its requirements', () => {
    const capabilityWorkstreams = [seed('Data Management', [seedDriver('Member data management', ['CAP_12', 'DATA_01'])])];
    const data = [seedDriver('Member and policy document data', ['DATA_01'])];
    const reconciled = reconcileCapabilityWorkstreams(capabilityWorkstreams, { ai: [], integration: [], data }, facts);
    expect(reconciled.flatMap((ws) => ws.drivers)).toEqual([]);
  });

  it('drops a capability driver whose requirements are priced across several specialised drivers', () => {
    const capabilityWorkstreams = [seed('Member Services', [seedDriver('Synced member records', ['CAP_14', 'INT_01', 'DATA_01'])])];
    const integration = [seedDriver('Salesforce CRM profile sync', ['IS_01', 'INT_01', 'ARC_03'])];
    const data = [seedDriver('Member and policy document data', ['DATA_01'])];
    const reconciled = reconcileCapabilityWorkstreams(capabilityWorkstreams, { ai: [], integration, data }, facts);
    expect(reconciled.flatMap((ws) => ws.drivers)).toEqual([]);
  });

  it('keeps a capability driver while one of its requirements is priced nowhere else', () => {
    const capabilityWorkstreams = [seed('Member Experience', [seedDriver('Profile and documents', ['CAP_01', 'FR_01', 'DATA_01'])])];
    const data = [seedDriver('Member and policy document data', ['DATA_01'])];
    const reconciled = reconcileCapabilityWorkstreams(capabilityWorkstreams, { ai: [], integration: [], data }, facts);
    expect(reconciled.flatMap((ws) => ws.drivers)).toHaveLength(1);
  });

  it('merges two capabilities that cite an identical requirement set into one driver (rule 2)', () => {
    const capabilityWorkstreams = [
      seed('Analytics and Data Engineering', [seedDriver('Dashboards and Reporting', ['CAP_08', 'FR_02'])]),
      seed('Integration Layer', [seedDriver('Reporting Data Marts', ['CAP_17', 'FR_02'])]),
    ];
    const reconciled = reconcileCapabilityWorkstreams(capabilityWorkstreams, { ai: [], integration: [], data: [] }, facts);
    const drivers = reconciled.flatMap((ws) => ws.drivers);
    expect(drivers).toHaveLength(1);
    expect(drivers.at(0)?.label).toBe('Dashboards and Reporting / Reporting Data Marts');
    expect(drivers.at(0)?.refIds).toEqual(expect.arrayContaining(['CAP_08', 'CAP_17', 'FR_02']));
  });

  it('leaves capability drivers with distinct requirement sets untouched', () => {
    const capabilityWorkstreams = [seed('Member Experience', [seedDriver('Registration and profile', ['CAP_01', 'FR_01'])])];
    const reconciled = reconcileCapabilityWorkstreams(capabilityWorkstreams, { ai: [], integration: [], data: [] }, facts);
    expect(reconciled.flatMap((ws) => ws.drivers)).toHaveLength(1);
  });

  it('never groups drivers that cite no reviewed requirement at all', () => {
    const capabilityWorkstreams = [
      seed('Integration Layer', [seedDriver('File-Based Integration Platform', ['CAP_09'])]),
      seed('Other', [seedDriver('Something else', ['CAP_10'])]),
    ];
    const reconciled = reconcileCapabilityWorkstreams(capabilityWorkstreams, { ai: [], integration: [], data: [] }, facts);
    expect(reconciled.flatMap((ws) => ws.drivers)).toHaveLength(2);
  });
});

describe('findDoubleCountedDrivers', () => {
  it('finds nothing when every driver has distinct refIds', () => {
    const suggestion = suggestionOf([
      workstream('WS_01', 'PH_2', [driver('DRV_01', 'capability', 'Medium', ['FR_01'])]),
      workstream('WS_02', 'PH_3', [driver('DRV_02', 'integration', 'High', ['INT_01'])]),
    ]);
    expect(findDoubleCountedDrivers(suggestion)).toEqual([]);
  });

  it('flags two drivers in different workstreams that cite the identical set of ids', () => {
    const suggestion = suggestionOf([
      workstream('WS_01', 'PH_2', [driver('DRV_01', 'capability', 'Medium', ['FR_01'])]),
      workstream('WS_02', 'PH_4', [driver('DRV_02', 'ai', 'High', ['FR_01'])]),
    ]);
    expect(findDoubleCountedDrivers(suggestion)).toEqual([
      { workstreamA: 'WS_01', driverA: 'DRV_01', workstreamB: 'WS_02', driverB: 'DRV_02', refIds: ['FR_01'] },
    ]);
  });

  it('flags a capability driver whose reviewed requirements are all priced by data or AI drivers elsewhere', () => {
    const suggestion = suggestionOf([
      workstream('WS_01', 'PH_2', [driver('DRV_01', 'capability', 'Medium', ['CAP_09', 'DATA_01', 'FR_03'])], ['DATA_01', 'FR_03']),
      workstream('WS_02', 'PH_3', [driver('DRV_02', 'data', 'Medium', ['DATA_01'])], ['DATA_01']),
      workstream('WS_03', 'PH_4', [driver('DRV_03', 'ai', 'High', ['AIUC_01', 'FR_03'])], ['FR_03']),
    ]);
    expect(findDoubleCountedDrivers(suggestion)).toEqual([
      { workstreamA: 'WS_01', driverA: 'DRV_01', workstreamB: 'WS_02', driverB: 'DRV_02', refIds: ['DATA_01'] },
      { workstreamA: 'WS_01', driverA: 'DRV_01', workstreamB: 'WS_03', driverB: 'DRV_03', refIds: ['FR_03'] },
    ]);
  });

  it('accepts a capability driver that shares only part of its requirements with specialised drivers', () => {
    const suggestion = suggestionOf([
      workstream('WS_01', 'PH_2', [driver('DRV_01', 'capability', 'Medium', ['CAP_01', 'FR_01', 'DATA_01'])], ['FR_01', 'DATA_01']),
      workstream('WS_02', 'PH_3', [driver('DRV_02', 'data', 'Medium', ['DATA_01'])], ['DATA_01']),
      workstream('WS_03', 'PH_2', [driver('DRV_03', 'nonFunctional', 'Low', ['FR_01'])], ['FR_01']),
    ]);
    expect(findDoubleCountedDrivers(suggestion)).toEqual([]);
  });

  it('ignores two drivers in the same workstream, and drivers with no refIds', () => {
    const suggestion = suggestionOf([
      workstream('WS_01', 'PH_2', [driver('DRV_01', 'capability', 'Medium', ['FR_01']), driver('DRV_02', 'capability', 'Medium', ['FR_01'])]),
      workstream('WS_02', 'PH_3', [driver('DRV_03', 'infrastructure', 'Low', [])]),
      workstream('WS_03', 'PH_4', [driver('DRV_04', 'ai', 'Low', [])]),
    ]);
    expect(findDoubleCountedDrivers(suggestion)).toEqual([]);
  });
});
