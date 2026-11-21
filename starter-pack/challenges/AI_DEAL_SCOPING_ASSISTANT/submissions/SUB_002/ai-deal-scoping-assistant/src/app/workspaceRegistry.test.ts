/**
 * Unit tests for the workspace registry: it must expose every one of the six recommended
 * application sections, in journey order, each resolved to a real component through the `Map`
 * lookup (never a dynamic property access).
 */
import { WORKSPACE_META } from '../ui/shell';
import { getWorkspaceEntry, workspaceRegistryEntries } from './workspaceRegistry';

describe('workspaceRegistryEntries', () => {
  it('lists all six workspaces in journey order, matching WORKSPACE_META', () => {
    const entries = workspaceRegistryEntries();
    expect(entries.map((entry) => entry.id)).toEqual(WORKSPACE_META.map((meta) => meta.id));
    expect(entries.map((entry) => entry.label)).toEqual(WORKSPACE_META.map((meta) => meta.label));
  });

  it('resolves a real component for every workspace id', () => {
    for (const entry of workspaceRegistryEntries()) {
      expect(typeof entry.Component).toBe('function');
    }
  });
});

describe('getWorkspaceEntry', () => {
  it('finds the registry entry for every known workspace id', () => {
    for (const meta of WORKSPACE_META) {
      expect(getWorkspaceEntry(meta.id)?.id).toBe(meta.id);
    }
  });
});
