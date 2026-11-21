import { fixtureSession } from '../../../test/fixtures';
import {
  buildChangeMutation,
  createDefaultDraft,
  inclusionCandidates,
  integrationDrivers,
} from './changeTypes';
import type { ChangeDraft } from './changeTypes';

describe('createDefaultDraft', () => {
  it('defaults to the cloud platform change type, seeded from the current configuration', () => {
    const session = fixtureSession();
    const draft = createDefaultDraft(session);
    expect(draft.type).toBe('cloud-platform');
    expect(draft.cloudPlatform).toBe(session.config.cloudPlatform);
    expect(draft.requirementId).toBe('BR_01');
    expect(draft.securityItemId).toBe('SEC_01');
    expect(draft.scopeItemId).not.toBe('');
  });

  it('leaves driver and rate fields empty when nothing is available yet', () => {
    const session = fixtureSession();
    const draft = createDefaultDraft(session);
    expect(draft.integrationDriverId).toBe('');
    expect(draft.rateAmount).toBe('');
  });
});

describe('inclusionCandidates / integrationDrivers', () => {
  it('lists every active requirement-kind item as an inclusion candidate', () => {
    const session = fixtureSession();
    const candidates = inclusionCandidates(session);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((item) => item.inScope)).toBe(true);
  });

  it('returns no integration drivers before an estimate has been generated', () => {
    const session = fixtureSession();
    expect(integrationDrivers(session)).toEqual([]);
  });

  it('returns an empty list when there is no reviewed scope at all', () => {
    const session = { ...fixtureSession(), scope: null };
    expect(inclusionCandidates(session)).toEqual([]);
  });
});

describe('buildChangeMutation', () => {
  const session = fixtureSession();
  const baseDraft = createDefaultDraft(session);

  function draft(patch: Partial<ChangeDraft>): ChangeDraft {
    return { ...baseDraft, ...patch };
  }

  it('builds a cloud-platform mutation that marks the platform as user-selected', () => {
    const mutation = buildChangeMutation(draft({ type: 'cloud-platform', cloudPlatform: 'gcp' }));
    expect(mutation).not.toBeNull();
    const next = mutation?.(session);
    expect(next?.config.cloudPlatform).toBe('gcp');
    expect(next?.config.cloudSelectionMode).toBe('user-selected');
  });

  it('rejects an expected-users change with a blank or non-positive value', () => {
    expect(buildChangeMutation(draft({ type: 'expected-users', expectedUsers: '' }))).toBeNull();
    expect(buildChangeMutation(draft({ type: 'expected-users', expectedUsers: '0' }))).toBeNull();
  });

  it('builds an expected-users mutation from a valid positive integer', () => {
    const mutation = buildChangeMutation(draft({ type: 'expected-users', expectedUsers: '500000' }));
    const next = mutation?.(session);
    expect(next?.config.expectedUsers).toBe(500000);
  });

  it('rejects a requirement-priority change with no requirement selected', () => {
    expect(buildChangeMutation(draft({ type: 'requirement-priority', requirementId: '' }))).toBeNull();
  });

  it('builds a requirement-priority mutation that updates the chosen requirement', () => {
    const mutation = buildChangeMutation(draft({ type: 'requirement-priority', requirementId: 'FR_02', priority: 'High' }));
    const next = mutation?.(session);
    const updated = next?.scope?.items.find((item) => item.id === 'FR_02');
    expect(updated?.priority).toBe('High');
  });

  it('rejects a security-requirement change with blank replacement text', () => {
    expect(buildChangeMutation(draft({ type: 'security-requirement', securityItemId: 'SEC_01', securityText: '   ' }))).toBeNull();
  });

  it('builds a security-requirement mutation that replaces the description', () => {
    const mutation = buildChangeMutation(draft({ type: 'security-requirement', securityItemId: 'SEC_01', securityText: 'Rotate keys quarterly.' }));
    const next = mutation?.(session);
    const updated = next?.scope?.items.find((item) => item.id === 'SEC_01');
    expect(updated?.description).toBe('Rotate keys quarterly.');
  });

  it('rejects a scope-inclusion change with no requirement selected', () => {
    expect(buildChangeMutation(draft({ type: 'scope-inclusion', scopeItemId: '' }))).toBeNull();
  });

  it('builds a scope-inclusion mutation that toggles a requirement out of scope', () => {
    const mutation = buildChangeMutation(draft({ type: 'scope-inclusion', scopeItemId: 'FR_03', scopeInclusion: 'exclude' }));
    const next = mutation?.(session);
    const updated = next?.scope?.items.find((item) => item.id === 'FR_03');
    expect(updated?.inScope).toBe(false);
  });

  it('rejects a contingency change with a negative percentage', () => {
    expect(buildChangeMutation(draft({ type: 'contingency', contingencyPct: '-5' }))).toBeNull();
  });

  it('builds a contingency mutation from a valid non-negative percentage', () => {
    const mutation = buildChangeMutation(draft({ type: 'contingency', contingencyPct: '15' }));
    const next = mutation?.(session);
    expect(next?.estimationConfig.contingencyPct).toBe(15);
  });

  it('always builds an ai-provider-preference mutation, regardless of other fields', () => {
    const mutation = buildChangeMutation(draft({ type: 'ai-provider-preference', aiProviderPreference: 'anthropic' }));
    const next = mutation?.(session);
    expect(next?.config.aiProviderPreference).toBe('anthropic');
  });

  it('rejects an integration-complexity change when there are no drivers yet', () => {
    expect(buildChangeMutation(draft({ type: 'integration-complexity', integrationDriverId: '' }))).toBeNull();
  });

  it('rejects a rate-card change with no role selected or a non-positive amount', () => {
    expect(buildChangeMutation(draft({ type: 'rate-card', rateRoleId: '', rateAmount: '900' }))).toBeNull();
    const firstRole = session.estimationConfig.rates.at(0)?.roleId ?? '';
    expect(buildChangeMutation(draft({ type: 'rate-card', rateRoleId: firstRole, rateAmount: '0' }))).toBeNull();
  });

  it('builds a rate-card mutation that updates only the chosen role', () => {
    const firstRole = session.estimationConfig.rates.at(0);
    if (firstRole === undefined) {
      throw new Error('Fixture session must configure at least one rate.');
    }
    const mutation = buildChangeMutation(draft({ type: 'rate-card', rateRoleId: firstRole.roleId, rateAmount: '950' }));
    const next = mutation?.(session);
    const updatedRate = next?.estimationConfig.rates.find((rate) => rate.roleId === firstRole.roleId);
    expect(updatedRate?.dayRate).toBe(950);
  });

  it('rejects a delivery-deadline change with a blank or non-positive value', () => {
    expect(buildChangeMutation(draft({ type: 'delivery-deadline', deadlineWeeks: '' }))).toBeNull();
    expect(buildChangeMutation(draft({ type: 'delivery-deadline', deadlineWeeks: '-2' }))).toBeNull();
  });

  it('builds a delivery-deadline mutation from a valid week count', () => {
    const mutation = buildChangeMutation(draft({ type: 'delivery-deadline', deadlineWeeks: '20' }));
    const next = mutation?.(session);
    expect(next?.config.deliveryDeadlineWeeks).toBe(20);
  });
});
