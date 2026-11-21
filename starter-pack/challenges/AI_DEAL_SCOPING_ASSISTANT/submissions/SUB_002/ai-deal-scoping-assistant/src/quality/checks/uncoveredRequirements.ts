import { notGenerated, warn } from '../checkKit';
import type { GradedFinding, QualityCheckSpec, QualityContext } from '../types';

function run(context: QualityContext): GradedFinding[] {
  if (context.scope === null) {
    return [notGenerated('there is no reviewed scope model to measure requirement coverage against.')];
  }
  return context.coverage.rows
    .filter((row) => !row.covered)
    .map((row) => warn(`${row.requirementId} "${row.title}" (${row.priority} priority) is not covered by any generated capability, component or strategy element.`, [row.requirementId]));
}

export const uncoveredRequirementsCheck: QualityCheckSpec = {
  id: 'uncovered-requirements',
  label: 'Uncovered requirements',
  description: 'Reviewed, in-scope requirements that no generated deliverable cites, so the reviewer does not have to compare the documents manually.',
  run,
};
