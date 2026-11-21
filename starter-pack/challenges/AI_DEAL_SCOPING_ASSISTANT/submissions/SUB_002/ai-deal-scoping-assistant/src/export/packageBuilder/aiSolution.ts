/**
 * "AI solution approach" package section (spec 6): use cases (with their id, retrieval,
 * orchestration, safety, human-review, monitoring and AI-specific-requirement detail, so the
 * exported package carries the same per-use-case information the workspace shows, not only the
 * aggregate architecture/prompt/evaluation text), the AI vs deterministic vs human-decision
 * boundary table, responsible AI, evaluation, monitoring and privacy.
 */
import type { AiUseCase, DocBlock, PackageSection, ProcessingBoundary, ScopeItem, ScopeModel, ScopingSession, TracedStatement } from '../../domain';
import { findItem } from '../../scope';
import { headingBlock, joinOrFallback, notGeneratedCallout, provenanceBlock, refsCell, statementLine, tableOrParagraph } from '../text';

const USE_CASE_COLUMNS = ['ID', 'Use case', 'Description', 'Pattern', 'Model options', 'Complexity', 'Requirements'] as const;

function useCaseRow(useCase: AiUseCase): string[] {
  return [useCase.id, useCase.name, useCase.description, useCase.pattern, joinOrFallback(useCase.modelOptions, 'Not yet specified'), useCase.complexity, refsCell(useCase.requirementIds)];
}

/** Requirement kinds spec 4's "AI-specific requirements" refers to: non-functional, security and data items, as distinct from the functional description already in the use-case row. */
const AI_SPECIFIC_REQUIREMENT_KINDS: ReadonlySet<ScopeItem['kind']> = new Set(['nonFunctional', 'security', 'data']);

/** The use case's own linked requirements that are themselves AI-specific (a latency target, a data-handling rule, a security control), named by id and title so the export states which requirement each safeguard responds to. */
function aiSpecificRequirements(scope: ScopeModel | null, useCase: AiUseCase): string {
  if (scope === null) {
    return '';
  }
  const names = useCase.requirementIds
    .map((id) => findItem(scope, id))
    .filter((item): item is ScopeItem => item !== undefined && AI_SPECIFIC_REQUIREMENT_KINDS.has(item.kind))
    .map((item) => `${item.id} (${item.title})`);
  return names.join(', ');
}

/** Optional per-use-case detail fields the UI already shows (AiUseCaseCards); each is skipped from the export when blank rather than printed as an empty value. */
const USE_CASE_DETAIL_FIELDS: readonly [string, (useCase: AiUseCase) => string][] = [
  ['Retrieval', (useCase) => useCase.retrieval],
  ['Orchestration', (useCase) => useCase.orchestration],
  ['Safety controls', (useCase) => useCase.safety],
  ['Human review', (useCase) => useCase.humanReview],
  ['Monitoring', (useCase) => useCase.monitoring],
];

/** A heading plus key/value detail block for one use case, or nothing when it has no retrieval/orchestration/safety/human-review/monitoring text and no AI-specific requirement of its own. */
function useCaseDetailBlocks(useCase: AiUseCase, scope: ScopeModel | null): DocBlock[] {
  const pairs = USE_CASE_DETAIL_FIELDS.map(([key, read]) => ({ key, value: read(useCase) })).filter((pair) => pair.value.trim().length > 0);
  const aiSpecific = aiSpecificRequirements(scope, useCase);
  if (aiSpecific.length > 0) {
    pairs.push({ key: 'AI-specific requirements', value: aiSpecific });
  }
  return pairs.length === 0 ? [] : [headingBlock(4, useCase.name), { type: 'keyValues', pairs }];
}

const PROCESSING_TYPE_TEXT: ReadonlyMap<ProcessingBoundary['type'], string> = new Map([
  ['ai', 'AI'],
  ['deterministic', 'Deterministic rule or calculation'],
  ['human-decision', 'Mandatory human decision'],
]);

function boundaryRow(boundary: ProcessingBoundary): string[] {
  return [boundary.activity, PROCESSING_TYPE_TEXT.get(boundary.type) ?? boundary.type, boundary.reason, refsCell(boundary.requirementIds)];
}

function statementParagraphs(statements: readonly TracedStatement[], emptyMessage: string) {
  return statements.length === 0 ? [{ type: 'paragraph' as const, text: emptyMessage }] : statements.map((statement) => ({ type: 'paragraph' as const, text: statementLine(statement) }));
}

export function buildAiSolutionSection(session: ScopingSession): PackageSection {
  const strategy = session.outputs.aiStrategy.data;
  if (strategy === null) {
    return { id: 'ai-solution-approach', title: 'AI solution approach', blocks: [notGeneratedCallout('the AI solution approach has not been generated yet')] };
  }
  const provenance = provenanceBlock(session.outputs.aiStrategy.meta);
  if (!strategy.applicable) {
    return {
      id: 'ai-solution-approach',
      title: 'AI solution approach',
      blocks: [...(provenance === null ? [] : [provenance]), ...statementParagraphs(strategy.summary, 'AI is not applicable to this engagement.')],
    };
  }
  return {
    id: 'ai-solution-approach',
    title: 'AI solution approach',
    blocks: [
      ...(provenance === null ? [] : [provenance]),
      ...statementParagraphs(strategy.summary, 'No AI strategy summary was generated.'),
      headingBlock(3, 'AI use cases'),
      tableOrParagraph([...USE_CASE_COLUMNS], strategy.useCases.map(useCaseRow), 'No AI use cases were identified for this engagement.'),
      ...strategy.useCases.flatMap((useCase) => useCaseDetailBlocks(useCase, session.scope)),
      headingBlock(3, 'AI vs deterministic vs human-decision boundaries'),
      tableOrParagraph(['Activity', 'Type', 'Reason', 'Requirements'], strategy.boundaries.map(boundaryRow), 'No processing boundaries were defined.'),
      headingBlock(3, 'Architecture pattern'),
      { type: 'paragraph', text: strategy.architecturePattern.trim().length > 0 ? strategy.architecturePattern : 'No AI architecture pattern was proposed.' },
      headingBlock(3, 'Prompt management'),
      { type: 'paragraph', text: strategy.promptManagement.trim().length > 0 ? strategy.promptManagement : 'No prompt-management approach was proposed.' },
      headingBlock(3, 'Evaluation approach'),
      { type: 'paragraph', text: strategy.evaluationApproach.trim().length > 0 ? strategy.evaluationApproach : 'No evaluation approach was proposed.' },
      headingBlock(3, 'Responsible AI'),
      strategy.responsibleAi.length === 0 ? { type: 'paragraph', text: 'No responsible-AI safeguards were proposed.' } : { type: 'list', items: [...strategy.responsibleAi] },
      headingBlock(3, 'Monitoring and feedback'),
      { type: 'paragraph', text: strategy.monitoringAndFeedback.trim().length > 0 ? strategy.monitoringAndFeedback : 'No monitoring or feedback approach was proposed.' },
      headingBlock(3, 'Data privacy'),
      { type: 'paragraph', text: strategy.dataPrivacy.trim().length > 0 ? strategy.dataPrivacy : 'No data-privacy approach was proposed.' },
    ],
  };
}
