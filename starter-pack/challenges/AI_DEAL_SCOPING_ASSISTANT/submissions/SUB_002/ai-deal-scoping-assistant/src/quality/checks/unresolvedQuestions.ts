import { getOpenQuestions } from '../../scope';
import { criticalFirst, notGenerated, warn } from '../checkKit';
import type { GradedFinding, QualityCheckSpec, QualityContext } from '../types';

function run(context: QualityContext): GradedFinding[] {
  if (context.scope === null) {
    return [notGenerated('there is no reviewed scope model, so no clarification questions have been raised.')];
  }
  return criticalFirst(getOpenQuestions(context.scope)).map((question) =>
    warn(`${question.critical ? 'Critical clarification question' : 'Clarification question'} ${question.id} is unanswered: ${question.title}`, [question.id, ...question.relatedIds]),
  );
}

export const unresolvedQuestionsCheck: QualityCheckSpec = {
  id: 'unresolved-questions',
  label: 'Unresolved clarification questions',
  description: 'Clarification questions to the customer that are still open; critical questions are listed first.',
  run,
};
