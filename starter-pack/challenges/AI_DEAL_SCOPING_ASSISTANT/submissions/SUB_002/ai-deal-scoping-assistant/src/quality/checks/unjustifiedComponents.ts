import type { ArchitectureComponent } from '../../domain';
import { fail, notGenerated } from '../checkKit';
import type { GradedFinding, QualityCheckSpec, QualityContext } from '../types';

function describeGap(component: ArchitectureComponent): string {
  const cited = [...component.requirementIds, ...component.assumptionIds];
  return cited.length === 0
    ? 'cites no reviewed requirement or assumption'
    : `only cites ids that are not in the reviewed scope model (${cited.join(', ')})`;
}

function run(context: QualityContext): GradedFinding[] {
  const architecture = context.session.outputs.architecture.data;
  if (architecture === null) {
    return [notGenerated('the solution architecture does not exist, so component justification cannot be checked.')];
  }
  return architecture.components
    .filter((component) => ![...component.requirementIds, ...component.assumptionIds].some((id) => context.knownIds.has(id)))
    .map((component) => fail(`Architecture component ${component.id} "${component.name}" (${component.service}) ${describeGap(component)}, so its place in the design is not justified.`, [component.id]));
}

export const unjustifiedComponentsCheck: QualityCheckSpec = {
  id: 'unjustified-components',
  label: 'Architecture components without requirement justification',
  description: 'Every architecture component references at least one reviewed requirement or assumption that justifies it.',
  run,
};
