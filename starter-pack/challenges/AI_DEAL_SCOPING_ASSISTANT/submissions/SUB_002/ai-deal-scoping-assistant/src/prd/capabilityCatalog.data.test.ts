import { describe, expect, it } from 'vitest';
import { SIGNAL_DEFINITIONS } from '../domain';
import { CAPABILITY_CATALOG, CORE_PLATFORM_CAPABILITY, findCatalogEntry, findCatalogEntryByName } from './capabilityCatalog.data';

const ROUTED_SIGNAL_GROUPS = new Set(['capability', 'integration', 'data', 'ai', 'security']);

describe('CAPABILITY_CATALOG', () => {
  it('has exactly one row per capability/integration/data/ai/security signal so none silently falls through', () => {
    const routedSignals = SIGNAL_DEFINITIONS.filter((signal) => ROUTED_SIGNAL_GROUPS.has(signal.group));
    for (const signal of routedSignals) {
      expect(findCatalogEntry(signal.id)).toBeDefined();
    }
    expect(CAPABILITY_CATALOG).toHaveLength(routedSignals.length);
  });

  it('never routes an nfr:* or compliance:* signal (those fall back to Core Platform Services)', () => {
    const unrouted = SIGNAL_DEFINITIONS.filter((signal) => signal.group === 'nfr' || signal.group === 'compliance');
    for (const signal of unrouted) {
      expect(findCatalogEntry(signal.id)).toBeUndefined();
    }
  });

  it('gives every row a non-empty capability name, scope intro and at least one acceptance hint', () => {
    for (const entry of CAPABILITY_CATALOG) {
      expect(entry.capabilityName.length).toBeGreaterThan(0);
      expect(entry.scopeIntro.length).toBeGreaterThan(0);
      expect(entry.acceptanceHints.length).toBeGreaterThan(0);
    }
  });

  it('keeps module/workstream/deliveryPackage/challengeType consistent for signals that share a capability name', () => {
    const byName = new Map<string, (typeof CAPABILITY_CATALOG)[number][]>();
    for (const entry of CAPABILITY_CATALOG) {
      const group = byName.get(entry.capabilityName) ?? [];
      group.push(entry);
      byName.set(entry.capabilityName, group);
    }
    for (const group of byName.values()) {
      const [first, ...rest] = group;
      for (const entry of rest) {
        expect(entry.module).toBe(first?.module);
        expect(entry.workstream).toBe(first?.workstream);
        expect(entry.deliveryPackage).toBe(first?.deliveryPackage);
        expect(entry.challengeType).toBe(first?.challengeType);
      }
    }
  });

  it('resolves the Core Platform Services fallback by name for the delivery-package challenge-type lookup', () => {
    expect(findCatalogEntryByName('Core Platform Services')).toBe(CORE_PLATFORM_CAPABILITY);
  });
});
