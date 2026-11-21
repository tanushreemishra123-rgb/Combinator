import { getActiveItems, getUnvalidatedAssumptions } from '../../scope';
import { criticalFirst, nameItem, notGenerated, warn } from '../checkKit';
import type { GradedFinding, QualityCheckSpec, QualityContext } from '../types';

function run(context: QualityContext): GradedFinding[] {
  if (context.scope === null) {
    return [notGenerated('there is no reviewed scope model, so no assumptions have been recorded.')];
  }
  const assumptions = criticalFirst(getUnvalidatedAssumptions(context.scope)).map((assumption) =>
    warn(`${assumption.critical ? 'Critical assumption' : 'Assumption'} ${nameItem(assumption)} has not been validated by a qualified stakeholder.`, [assumption.id, ...assumption.relatedIds]),
  );
  const pendingReview = getActiveItems(context.scope)
    .filter((item) => item.review === 'pending' && item.kind !== 'assumption')
    .map((item) => warn(`${nameItem(item)} (${item.provenance}) is still pending human review in the scope model.`, [item.id]));
  return [...assumptions, ...pendingReview];
}

export const assumptionsNeedingValidationCheck: QualityCheckSpec = {
  id: 'assumptions-needing-validation',
  label: 'Assumptions requiring human validation',
  description: 'Assumptions that no human has validated yet and scope items still pending review; the package relies on them until a qualified stakeholder confirms them.',
  run,
};
