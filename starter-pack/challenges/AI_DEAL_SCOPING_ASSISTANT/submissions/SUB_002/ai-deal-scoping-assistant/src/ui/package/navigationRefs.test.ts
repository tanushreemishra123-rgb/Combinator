import { targetTypeLabel, workspaceForRef } from './navigationRefs';

describe('workspaceForRef', () => {
  it('resolves a requirement-kind id to the Customer Requirements Workspace', () => {
    expect(workspaceForRef('FR_01')).toBe('requirements');
    expect(workspaceForRef('NFR_02')).toBe('requirements');
  });

  it('resolves generated-element prefixes to the workspace that produced them', () => {
    expect(workspaceForRef('CAP_03')).toBe('prd');
    expect(workspaceForRef('ARC_07')).toBe('architecture');
    expect(workspaceForRef('DD_01')).toBe('strategy');
    expect(workspaceForRef('WS_02')).toBe('estimate');
  });

  it('falls back to the Customer Requirements Workspace for an unrecognised id', () => {
    expect(workspaceForRef('UNKNOWN_01')).toBe('requirements');
    expect(workspaceForRef('')).toBe('requirements');
  });
});

describe('targetTypeLabel', () => {
  it('names every trace target type', () => {
    expect(targetTypeLabel('capability')).toBe('Capability');
    expect(targetTypeLabel('component')).toBe('Architecture component');
    expect(targetTypeLabel('workstream')).toBe('Workstream');
  });
});
