import { fail, notGenerated } from '../checkKit';
import type { GradedFinding, QualityCheckSpec, QualityContext } from '../types';

function run(context: QualityContext): GradedFinding[] {
  if (context.scope === null) {
    return [notGenerated('there is no reviewed scope model, so coverage of high-priority requirements cannot be demonstrated.', 'fail')];
  }
  return context.coverage.rows
    .filter((row) => row.priority === 'High' && !row.covered)
    .map((row) =>
      fail(`${row.requirementId} "${row.title}" is a High-priority requirement that no capability, architecture component or strategy element covers.`, [row.requirementId]),
    );
}

/** Blocks export: a package that misses a High-priority requirement is not a valid basis for scoping. */
export const highPriorityCoverageCheck: QualityCheckSpec = {
  id: 'high-priority-coverage',
  label: 'Coverage of high-priority requirements',
  description: 'Every High-priority requirement in the reviewed scope model is covered by at least one capability, architecture component or strategy element.',
  run,
};
