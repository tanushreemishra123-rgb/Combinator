import type { AiUseCase, ScopingSession } from '../../domain';
import { fixtureSession } from '../../test/fixtures';
import { buildFullyPopulatedSession } from '../packageFixture.data';
import { buildAiSolutionSection } from './aiSolution';

/** A fully populated session with its one AI use case replaced, so a test can control retrieval/orchestration/safety/human-review/monitoring and requirementIds without rebuilding the whole fixture. */
function sessionWithUseCase(useCase: AiUseCase): ScopingSession {
  const populated = buildFullyPopulatedSession();
  const strategy = populated.outputs.aiStrategy.data;
  if (strategy === null) {
    throw new Error('expected an AI strategy');
  }
  return { ...populated, outputs: { ...populated.outputs, aiStrategy: { ...populated.outputs.aiStrategy, data: { ...strategy, useCases: [useCase] } } } };
}

const BASE_USE_CASE: AiUseCase = {
  id: 'AIUC_01',
  name: 'Policy question answering',
  description: 'Answers member questions from the policy document library.',
  requirementIds: [],
  pattern: 'Retrieval-augmented generation',
  modelOptions: ['Claude Haiku'],
  retrieval: '',
  orchestration: '',
  evaluation: '',
  safety: '',
  privacy: '',
  humanReview: '',
  monitoring: '',
  complexity: 'Medium',
};

describe('buildAiSolutionSection', () => {
  it('says the AI solution approach has not been generated yet without a strategy', () => {
    const section = buildAiSolutionSection(fixtureSession());
    expect(section.blocks.at(0)).toMatchObject({ type: 'callout', title: 'Not generated yet' });
  });

  it('lists use cases and the AI vs deterministic vs human-decision boundary table', () => {
    const section = buildAiSolutionSection(buildFullyPopulatedSession());
    const useCaseTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Use case'));
    expect(useCaseTable?.type).toBe('table');
    const boundaryTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Type'));
    expect(boundaryTable?.type).toBe('table');
    if (boundaryTable?.type === 'table') {
      const types = boundaryTable.rows.map((row) => row.at(1));
      expect(new Set(types).size).toBe(3);
    }
  });

  it('includes the use case id as its own table column', () => {
    const section = buildAiSolutionSection(buildFullyPopulatedSession());
    const useCaseTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Use case'));
    expect(useCaseTable?.type).toBe('table');
    if (useCaseTable?.type === 'table') {
      expect(useCaseTable.columns.at(0)).toBe('ID');
      expect(useCaseTable.rows.at(0)?.at(0)).toBe('AI_01');
    }
  });

  it('lists retrieval, orchestration, safety, human review and monitoring for a use case that states them, and the AI-specific requirements it cites', () => {
    const useCase: AiUseCase = {
      ...BASE_USE_CASE,
      requirementIds: ['SEC_01', 'FR_01'],
      retrieval: 'Vector search over indexed policy documents.',
      orchestration: 'Single-turn retrieval then generation.',
      safety: 'Refuses questions outside the policy document scope.',
      humanReview: 'Low-confidence answers are routed to a human agent.',
      monitoring: 'Answer feedback and confidence dashboards.',
    };
    const section = buildAiSolutionSection(sessionWithUseCase(useCase));
    const detailHeadingIndex = section.blocks.findIndex((block) => block.type === 'heading' && block.level === 4 && block.text === useCase.name);
    expect(detailHeadingIndex).toBeGreaterThanOrEqual(0);
    const detailBlock = section.blocks.at(detailHeadingIndex + 1);
    expect(detailBlock?.type).toBe('keyValues');
    if (detailBlock?.type === 'keyValues') {
      const byKey = new Map(detailBlock.pairs.map((pair) => [pair.key, pair.value]));
      expect(byKey.get('Retrieval')).toBe(useCase.retrieval);
      expect(byKey.get('Orchestration')).toBe(useCase.orchestration);
      expect(byKey.get('Safety controls')).toBe(useCase.safety);
      expect(byKey.get('Human review')).toBe(useCase.humanReview);
      expect(byKey.get('Monitoring')).toBe(useCase.monitoring);
      expect(byKey.get('AI-specific requirements')).toBe('SEC_01 (Encryption and GDPR)');
    }
  });

  it('omits the detail block for a use case with no retrieval/orchestration/safety/human-review/monitoring text and no AI-specific requirement', () => {
    const useCase: AiUseCase = { ...BASE_USE_CASE, requirementIds: ['FR_01'] };
    const section = buildAiSolutionSection(sessionWithUseCase(useCase));
    const detailHeading = section.blocks.find((block) => block.type === 'heading' && block.level === 4 && block.text === useCase.name);
    expect(detailHeading).toBeUndefined();
  });

  it('explains why AI is not applicable instead of showing empty use-case tables', () => {
    const populated = buildFullyPopulatedSession();
    const strategy = populated.outputs.aiStrategy.data;
    if (strategy === null) {
      throw new Error('expected an AI strategy');
    }
    const notApplicable = { ...strategy, applicable: false, summary: [{ text: 'No AI capability was requested.', refs: [], label: 'ai-interpretation' as const }] };
    const section = buildAiSolutionSection({ ...populated, outputs: { ...populated.outputs, aiStrategy: { ...populated.outputs.aiStrategy, data: notApplicable } } });
    expect(section.blocks.some((block) => block.type === 'table')).toBe(false);
  });
});
