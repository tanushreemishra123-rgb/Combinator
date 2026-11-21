import { missingAiSafeguards } from '../../domain';
import type { AiSafeguardField, AiUseCase } from '../../domain';
import { fail, notGenerated } from '../checkKit';
import type { GradedFinding, QualityCheckSpec, QualityContext } from '../types';

/** How this check names each required safeguard, in the order it reports them. */
const SAFEGUARD_LABELS: readonly (readonly [AiSafeguardField, string])[] = [
  ['evaluation', 'evaluation'],
  ['privacy', 'privacy'],
  ['safety', 'safety'],
  ['humanReview', 'human-review'],
];

function missingSafeguards(useCase: AiUseCase): string[] {
  const missing = new Set<AiSafeguardField>(missingAiSafeguards(useCase));
  return SAFEGUARD_LABELS.filter(([field]) => missing.has(field)).map(([, label]) => label);
}

function run(context: QualityContext): GradedFinding[] {
  const strategy = context.session.outputs.aiStrategy.data;
  if (strategy === null) {
    return [notGenerated('the AI solution approach does not exist, so AI use-case safeguards cannot be checked.')];
  }
  return strategy.useCases.flatMap((useCase) => {
    const missing = missingSafeguards(useCase);
    return missing.length === 0
      ? []
      : [fail(`AI use case ${useCase.id} "${useCase.name}" has no ${missing.join(', ')} consideration and cannot be proposed responsibly without it.`, [useCase.id, ...useCase.requirementIds])];
  });
}

export const aiUseCaseSafeguardsCheck: QualityCheckSpec = {
  id: 'ai-use-case-safeguards',
  label: 'AI use cases missing evaluation, privacy, safety, or human-review considerations',
  description: 'Every AI use case states how it is evaluated, how privacy and safety are handled and where a human reviews the outcome.',
  run,
};
