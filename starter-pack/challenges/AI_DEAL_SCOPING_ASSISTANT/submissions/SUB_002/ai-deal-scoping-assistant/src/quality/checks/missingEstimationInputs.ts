import { getOpenGaps, getOpenQuestions } from '../../scope';
import type { EstimationInputKey, MissingEstimationInput, ScopeItem } from '../../domain';
import { fail, nameItem, notGenerated, warn } from '../checkKit';
import type { GradedFinding, QualityCheckSpec, QualityContext } from '../types';

const INPUT_LABELS: ReadonlyMap<EstimationInputKey, string> = new Map([
  ['expectedUsers', 'expected user volume'],
  ['environments', 'number of environments'],
  ['deliveryDeadline', 'delivery deadline'],
  ['integrationReadiness', 'integration readiness'],
  ['dataVolume', 'data volume'],
  ['complianceScope', 'compliance scope'],
  ['aiDataAvailability', 'AI data availability'],
  ['targetRegions', 'target regions'],
]);

/** A blocked calculation fails the gate; reduced confidence is a warning the reviewer can accept. */
function gradeMissingInput(input: MissingEstimationInput): GradedFinding {
  const blocked = input.effect === 'calculation-blocked';
  const effect = blocked ? 'blocks the calculation' : 'reduces estimate confidence';
  const affected = input.affected.length === 0 ? '' : ` for ${input.affected.join(', ')}`;
  const message = `${input.label} is missing and ${effect}${affected}. ${input.howToResolve}`;
  return blocked ? fail(message, input.relatedScopeIds) : warn(message, input.relatedScopeIds);
}

/** Before an estimate exists, open gaps and questions already show which inputs will be missing. */
function openInputGap(item: ScopeItem): GradedFinding {
  const inputs = item.affectsInputs.map((key) => INPUT_LABELS.get(key) ?? key).join(', ');
  return warn(`${nameItem(item)} is unresolved and leaves the ${inputs} undefined for the estimate.`, [item.id]);
}

function run(context: QualityContext): GradedFinding[] {
  const estimate = context.session.outputs.estimate.data;
  if (estimate !== null) {
    return estimate.result.missingInputs.map(gradeMissingInput);
  }
  const openItems = context.scope === null ? [] : [...getOpenGaps(context.scope), ...getOpenQuestions(context.scope)];
  return [
    notGenerated('the effort, timeline and ROM estimate does not exist, so missing estimation inputs are judged from the open gaps and questions only.'),
    ...openItems.filter((item) => item.affectsInputs.length > 0).map(openInputGap),
  ];
}

export const missingEstimationInputsCheck: QualityCheckSpec = {
  id: 'missing-estimation-inputs',
  label: 'Missing estimation inputs',
  description: 'Inputs the estimate needs but does not have: they either reduce confidence or block the calculation, and are never silently guessed.',
  run,
};
