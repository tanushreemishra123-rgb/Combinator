import { stageState } from '../../impact';
import { STAGES } from '../../domain';
import type { StageDescriptor } from '../../domain';
import { fail, notGenerated } from '../checkKit';
import type { GradedFinding, QualityCheckSpec, QualityContext } from '../types';

function gradeStage(stage: StageDescriptor, context: QualityContext): GradedFinding[] {
  const state = stageState(context.session.outputs, stage.id);
  if (state.status === 'stale') {
    const reasons = state.staleReasons.length === 0 ? 'a reviewed input changed after it was generated' : state.staleReasons.join('; ');
    return [fail(`${stage.label} is stale and must be regenerated or recalculated before export (${reasons}).`, stage.sections)];
  }
  return state.data === null ? [notGenerated(`${stage.label} is missing from the scoping package.`)] : [];
}

function run(context: QualityContext): GradedFinding[] {
  return STAGES.flatMap((stage) => gradeStage(stage, context));
}

/** Exporting a stale section would present content that contradicts the reviewed scope model or configuration. */
export const staleSectionsCheck: QualityCheckSpec = {
  id: 'stale-sections',
  label: 'Stale or missing sections',
  description: 'Sections affected by a change that have not been regenerated or recalculated yet, and sections that were never generated.',
  run,
};
