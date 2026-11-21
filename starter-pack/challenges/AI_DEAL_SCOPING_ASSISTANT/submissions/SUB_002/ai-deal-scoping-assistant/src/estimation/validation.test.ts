import type { EstimateSuggestion } from '../domain';
import { planEstimateInputs } from './inputPlanner';
import { driver, estimateContext, suggestionOf, workstream } from './testing/estimateFixtures';
import { containsEffortOrCostFigure, validateSuggestion } from './validation';

function codes(suggestion: EstimateSuggestion): string[] {
  return validateSuggestion(suggestion, estimateContext()).issues.map((issue) => issue.code);
}

describe('containsEffortOrCostFigure', () => {
  it('detects durations and money but not scope facts', () => {
    expect(containsEffortOrCostFigure('This needs about 20 person-days.')).toBe(true);
    expect(containsEffortOrCostFigure('Roughly 6 weeks of work.')).toBe(true);
    expect(containsEffortOrCostFigure('Budget of $250k.')).toBe(true);
    expect(containsEffortOrCostFigure('Around 40000 USD.')).toBe(true);
    expect(containsEffortOrCostFigure('Supports 50,000 users at 99.9% availability in 3 environments.')).toBe(false);
  });
});

describe('validateSuggestion', () => {
  it('accepts the planner output without any issue', () => {
    const planned = planEstimateInputs(estimateContext());
    const validated = validateSuggestion(planned, estimateContext());
    expect(validated.issues).toEqual([]);
    expect(validated.suggestion).toEqual(planned);
  });

  it('drops references that are not in the reviewed scope or its deliverables', () => {
    const suggestion = suggestionOf([workstream('WS_01', 'PH_2', [driver('DRV_01', 'capability', 'Low', ['FR_01', 'FR_99', 'CAP_01'])], ['FR_01', 'BR_77'])]);
    const validated = validateSuggestion({ ...suggestion, risks: [{ id: 'ER_01', text: 'Risk text.', refs: ['RSK_01', 'RSK_42'] }] }, estimateContext());
    const [first] = validated.suggestion.workstreams;
    expect(first?.requirementIds).toEqual(['FR_01']);
    expect(first?.drivers.at(0)?.refIds).toEqual(['FR_01', 'CAP_01']);
    expect(validated.suggestion.risks.at(0)?.refs).toEqual(['RSK_01']);
    expect(validated.issues.filter((issue) => issue.code === 'estimate.unknown-reference')).toHaveLength(3);
    expect(validated.issues.every((issue) => issue.severity === 'warning')).toBe(true);
  });

  it('moves workstreams outside PH_2..PH_4 to the phase of their driver type', () => {
    const suggestion = suggestionOf([
      workstream('WS_01', 'PH_1', [driver('DRV_01', 'integration', 'Low', ['INT_01'])]),
      workstream('WS_02', 'PH_9', [driver('DRV_02', 'ai', 'Low', ['FR_03'])]),
    ]);
    const validated = validateSuggestion(suggestion, estimateContext());
    expect(validated.suggestion.workstreams.map((entry) => entry.phaseId)).toEqual(['PH_3', 'PH_4']);
    expect(validated.issues.map((issue) => issue.code)).toEqual(['estimate.invalid-phase', 'estimate.invalid-phase']);
  });

  it('makes duplicate workstream, driver and note ids unique without cascading', () => {
    const suggestion = suggestionOf([
      workstream('WS_01', 'PH_2', [driver('DRV_01', 'capability', 'Low', ['FR_01']), driver('DRV_01', 'capability', 'Low', ['FR_02'])]),
      workstream('WS_01', 'PH_3', [driver('DRV_02', 'integration', 'Low', ['INT_01'])]),
    ]);
    const notes = [{ id: 'EX_01', text: 'First.', refs: [] }, { id: 'EX_01', text: 'Second.', refs: [] }];
    const validated = validateSuggestion({ ...suggestion, exclusions: notes }, estimateContext());
    expect(validated.suggestion.workstreams.map((entry) => entry.id)).toEqual(['WS_01', 'WS_02']);
    expect(validated.suggestion.workstreams.flatMap((entry) => entry.drivers.map((d) => d.id))).toEqual(['DRV_01', 'DRV_03', 'DRV_02']);
    expect(validated.suggestion.exclusions.map((note) => note.id)).toEqual(['EX_01', 'EX_02']);
    expect(validated.issues.filter((issue) => issue.code === 'estimate.duplicate-id')).toHaveLength(2);
  });

  it('removes AI-supplied effort and cost figures from rationale and explanation', () => {
    const base = driver('DRV_01', 'capability', 'Medium', ['FR_01']);
    const suggestion: EstimateSuggestion = {
      ...suggestionOf([
        workstream('WS_01', 'PH_2', [
          { ...base, rationale: 'Covers FR_01 with SSO. It should take about 15 days.' },
          { ...base, id: 'DRV_02', rationale: 'Roughly 3 weeks.' },
        ]),
      ]),
      explanation: 'Drivers follow the reviewed scope. Total cost is around $120,000.',
    };
    const validated = validateSuggestion(suggestion, estimateContext());
    const [first, second] = validated.suggestion.workstreams.at(0)?.drivers ?? [];
    expect(first?.rationale).toBe('Covers FR_01 with SSO.');
    expect(second?.rationale).toContain('effort is calculated from the base-effort table');
    expect(validated.suggestion.explanation).toBe('Drivers follow the reviewed scope.');
    expect(validated.issues.filter((issue) => issue.code === 'estimate.figure-removed')).toHaveLength(3);
  });

  it('flags drivers that cannot be traced to the reviewed scope', () => {
    expect(codes(suggestionOf([workstream('WS_01', 'PH_2', [driver('DRV_01', 'capability', 'Low', [])])]))).toEqual(['estimate.untraceable-driver']);
  });
});
