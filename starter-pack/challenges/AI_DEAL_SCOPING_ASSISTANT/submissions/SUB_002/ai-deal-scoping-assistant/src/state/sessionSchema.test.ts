vi.mock('../estimation', () => ({ calculateEstimate: vi.fn() }));

import { createDefaultEstimationConfig } from '../seed';
import { fixtureConfig, fixtureScope, FIXTURE_NOW } from '../test/fixtures';
import type { EstimateResult } from '../domain';
import { calculateEstimate } from '../estimation';
import { parseSession } from './sessionSchema';

const NOW = '2026-09-19T01:00:00.000Z';

function minimalRawSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'session-1',
    name: 'Test session',
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    customer: {},
    input: { rawText: 'We need a customer portal with SSO and reporting.' },
    scope: null,
    config: {},
    estimationConfig: createDefaultEstimationConfig(),
    outputs: { prd: {}, architecture: {}, dataIntegration: {}, aiStrategy: {}, estimate: {} },
    ...overrides,
  };
}

const VALID_SUGGESTION = {
  workstreams: [
    {
      id: 'WS_01',
      name: 'Core platform',
      phaseId: 'PH_1',
      drivers: [{ id: 'DRV_01', type: 'capability', label: 'Registration', complexity: 'Medium', rationale: 'Core capability.' }],
    },
  ],
};

const FAKE_ESTIMATE_RESULT: EstimateResult = {
  workstreams: [],
  phases: [],
  totals: {
    effortDays: { low: 0, likely: 0, high: 0 },
    effortPersonWeeks: { low: 0, likely: 0, high: 0 },
    timelineWeeks: { low: 0, likely: 0, high: 0 },
    subtotal: null,
    contingency: null,
    rom: null,
  },
  roleSummary: [],
  confidence: 'Medium',
  missingInputs: [],
  risks: [],
  dependencies: [],
  assumptions: [],
  exclusions: [],
  explanation: 'Fake result used only in tests.',
  rules: [],
  deadlineAssessment: '',
  configSnapshot: createDefaultEstimationConfig(),
  computedAt: NOW,
};

describe('parseSession', () => {
  it('accepts a minimal valid session and fills every default', () => {
    const result = parseSession(minimalRawSession(), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.session.id).toBe('session-1');
    expect(result.session.scope).toBeNull();
    expect(result.session.outputs.prd.status).toBe('empty');
    expect(result.session.changeLog).toEqual([]);
  });

  it('rejects data missing required fields with readable errors', () => {
    const result = parseSession({}, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((message) => message.includes('id'))).toBe(true);
  });

  it('rebuilds input.normalized from rawText and never trusts a stored copy', () => {
    const raw = minimalRawSession({
      input: { rawText: 'Line one.\nLine two.', normalized: { text: 'tampered', lines: [], sections: [], wordCount: 999 } },
    });
    const result = parseSession(raw, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.session.input.normalized?.text).toBe('Line one.\nLine two.');
    expect(result.session.input.normalized?.wordCount).not.toBe(999);
  });

  it('always resets quality to null, even when storage carries a stale report', () => {
    const raw = minimalRawSession({ quality: { checks: [], summary: {}, ranAt: NOW, scopeVersion: 3 } });
    const result = parseSession(raw, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.session.quality).toBeNull();
  });

  it('strips unknown top-level and nested keys instead of carrying them into the session', () => {
    const raw = minimalRawSession({
      apiKey: 'should-not-persist',
      customer: { customerName: 'Acme', notAField: 'nope' },
    });
    const result = parseSession(raw, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.session).not.toHaveProperty('apiKey');
    expect(result.session.customer).not.toHaveProperty('notAField');
    expect(result.session.customer.customerName).toBe('Acme');
  });

  it('rebuilds the estimate result with calculateEstimate rather than trusting the stored one', () => {
    vi.mocked(calculateEstimate).mockReturnValue(FAKE_ESTIMATE_RESULT);
    const raw = minimalRawSession({
      scope: fixtureScope(),
      config: fixtureConfig(),
      outputs: {
        prd: {},
        architecture: {},
        dataIntegration: {},
        aiStrategy: {},
        estimate: { data: { suggestion: VALID_SUGGESTION, overrides: [] }, status: 'current', reviewed: true, meta: null, staleReasons: [] },
      },
    });
    const result = parseSession(raw, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(calculateEstimate).toHaveBeenCalledTimes(1);
    expect(result.session.outputs.estimate.data?.result).toBe(FAKE_ESTIMATE_RESULT);
    expect(result.session.outputs.estimate.status).toBe('current');
    expect(result.session.outputs.estimate.reviewed).toBe(true);
  });

  it('resets the estimate section to empty when calculateEstimate throws', () => {
    vi.mocked(calculateEstimate).mockImplementation(() => {
      throw new Error('bad suggestion');
    });
    const raw = minimalRawSession({
      scope: fixtureScope(),
      config: fixtureConfig(),
      outputs: {
        prd: {},
        architecture: {},
        dataIntegration: {},
        aiStrategy: {},
        estimate: { data: { suggestion: VALID_SUGGESTION, overrides: [] }, status: 'current', reviewed: true, meta: null, staleReasons: [] },
      },
    });
    const result = parseSession(raw, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.session.outputs.estimate).toEqual({ data: null, status: 'empty', reviewed: false, meta: null, staleReasons: [] });
  });

  it('resets the estimate section to empty when there is estimate data but no reviewed scope', () => {
    const raw = minimalRawSession({
      scope: null,
      outputs: {
        prd: {},
        architecture: {},
        dataIntegration: {},
        aiStrategy: {},
        estimate: { data: { suggestion: VALID_SUGGESTION, overrides: [] }, status: 'current', reviewed: true, meta: null, staleReasons: [] },
      },
    });
    const result = parseSession(raw, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(calculateEstimate).not.toHaveBeenCalled();
    expect(result.session.outputs.estimate.data).toBeNull();
  });
});
