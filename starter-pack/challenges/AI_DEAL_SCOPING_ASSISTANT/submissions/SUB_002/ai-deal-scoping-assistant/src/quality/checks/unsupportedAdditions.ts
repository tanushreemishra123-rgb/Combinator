import type { Capability } from '../../domain';
import { warn } from '../checkKit';
import type { GradedFinding, QualityCheckSpec, QualityContext } from '../types';

function recommendedEnhancements(context: QualityContext): Capability[] {
  const functionalScope = context.session.outputs.prd.data?.functionalScope;
  if (functionalScope === undefined) {
    return [];
  }
  const labelled = functionalScope.capabilities.filter((capability) => capability.label === 'recommended-enhancement');
  return [...functionalScope.recommendedEnhancements, ...labelled];
}

/** A recommendation is supported only when it cites at least one reviewed, in-scope item. */
function isUnsupported(capability: Capability, context: QualityContext): boolean {
  return !capability.requirementIds.some((id) => context.knownIds.has(id));
}

function run(context: QualityContext): GradedFinding[] {
  const additions = context.coverage.unsupportedAdditions;
  const alreadyFlagged = new Set(additions.map((addition) => addition.targetId));
  const enhancements = recommendedEnhancements(context).filter((capability) => !alreadyFlagged.has(capability.id) && isUnsupported(capability, context));
  return [
    ...additions.map((addition) => warn(addition.reason, [addition.targetId, ...addition.unknownRefs])),
    ...enhancements.map((capability) =>
      warn(`Recommended enhancement "${capability.name}" (${capability.id}) is not backed by any reviewed requirement or assumption and must be confirmed with the customer or removed.`, [capability.id]),
    ),
  ];
}

export const unsupportedAdditionsCheck: QualityCheckSpec = {
  id: 'unsupported-additions',
  label: 'Unsupported scope additions',
  description: 'Generated elements and recommendations that cite no reviewed requirement or assumption, or cite ids outside the approved scope model.',
  run,
};
