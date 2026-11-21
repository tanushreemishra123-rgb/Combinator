import { describe, expect, it } from 'vitest';
import { buildAiStrategy, buildEmptyOutputsSession, buildHealthySession, buildQualityContext } from '../testFixtures.data';
import { aiUseCaseSafeguardsCheck } from './aiUseCaseSafeguards';

describe('aiUseCaseSafeguardsCheck', () => {
  it('passes when every AI use case states evaluation, privacy, safety and human-review', () => {
    expect(aiUseCaseSafeguardsCheck.run(buildQualityContext(buildHealthySession()))).toEqual([]);
  });

  it('fails and names every missing consideration for an AI use case', () => {
    const session = buildHealthySession({ outputs: { ...buildHealthySession().outputs, aiStrategy: { data: buildAiStrategy({ evaluation: '', humanReview: '' }), status: 'current', reviewed: true, meta: null, staleReasons: [] } } });
    const findings = aiUseCaseSafeguardsCheck.run(buildQualityContext(session));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.severity).toBe('fail');
    expect(findings.at(0)?.message).toContain('evaluation');
    expect(findings.at(0)?.message).toContain('human-review');
    expect(findings.at(0)?.message).not.toContain('privacy');
  });

  it('reports "Not generated yet" when the AI solution approach does not exist', () => {
    const findings = aiUseCaseSafeguardsCheck.run(buildQualityContext(buildEmptyOutputsSession()));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.notice).toBe(true);
  });

  it('passes trivially when the AI strategy states no use cases are applicable', () => {
    const session = buildHealthySession({ outputs: { ...buildHealthySession().outputs, aiStrategy: { data: { ...buildAiStrategy(), applicable: false, useCases: [] }, status: 'current', reviewed: true, meta: null, staleReasons: [] } } });
    expect(aiUseCaseSafeguardsCheck.run(buildQualityContext(session))).toEqual([]);
  });
});
