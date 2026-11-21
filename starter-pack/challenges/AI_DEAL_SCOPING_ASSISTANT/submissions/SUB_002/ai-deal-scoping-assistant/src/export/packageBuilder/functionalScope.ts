/**
 * "Functional scope" package section (spec 6): the capability table, the module / workstream /
 * delivery-package groupings, the AI-recommended enhancements (clearly marked) and out-of-scope items.
 */
import type { Capability, DeliveryPackagePlan, PackageSection, ScopeGrouping, ScopingSession, TracedStatement } from '../../domain';
import { contentLabelText, headingBlock, joinOrFallback, notGeneratedCallout, provenanceBlock, refsCell, tableOrParagraph } from '../text';

const CAPABILITY_COLUMNS = ['Capability', 'Included requirements', 'Scope', 'Priority', 'Dependencies', 'Label'] as const;

function capabilityRow(capability: Capability): string[] {
  return [capability.name, refsCell(capability.requirementIds), capability.scope, capability.priority, joinOrFallback(capability.dependencies, 'None'), contentLabelText(capability.label)];
}

function groupingRows(groups: readonly ScopeGrouping[]): string[][] {
  return groups.map((group) => [group.name, refsCell(group.capabilityIds), refsCell(group.requirementIds)]);
}

const ENGAGEMENT_MODEL_TEXT: ReadonlyMap<DeliveryPackagePlan['engagementModel'], string> = new Map([
  ['topcoder-challenge-series', 'Topcoder challenge series'],
  ['dedicated-team', 'Dedicated delivery team'],
  ['blended', 'Blended (dedicated team plus challenges)'],
]);

function deliveryPackageRows(packages: readonly DeliveryPackagePlan[]): string[][] {
  return packages.map((pkg) => [
    pkg.name,
    refsCell(pkg.capabilityIds),
    ENGAGEMENT_MODEL_TEXT.get(pkg.engagementModel) ?? pkg.engagementModel,
    joinOrFallback(pkg.suggestedChallengeTypes, 'Not yet suggested'),
  ]);
}

function outOfScopeBlock(items: readonly TracedStatement[]) {
  return tableOrParagraph(
    ['Item', 'Refs', 'Label'],
    items.map((item) => [item.text, refsCell(item.refs), contentLabelText(item.label)]),
    'No functional scope items were explicitly excluded.',
  );
}

export function buildFunctionalScopeSection(session: ScopingSession): PackageSection {
  const scope = session.outputs.prd.data?.functionalScope ?? null;
  if (scope === null) {
    return { id: 'functional-scope', title: 'Functional scope', blocks: [notGeneratedCallout('functional scope has not been generated yet')] };
  }
  const provenance = provenanceBlock(session.outputs.prd.meta);
  return {
    id: 'functional-scope',
    title: 'Functional scope',
    blocks: [
      ...(provenance === null ? [] : [provenance]),
      headingBlock(3, 'Capabilities'),
      tableOrParagraph([...CAPABILITY_COLUMNS], scope.capabilities.map(capabilityRow), 'No capabilities were derived from the reviewed scope.'),
      headingBlock(3, 'Recommended enhancements (AI recommendation)'),
      tableOrParagraph([...CAPABILITY_COLUMNS], scope.recommendedEnhancements.map(capabilityRow), 'No enhancements beyond the customer-requested scope were recommended.'),
      headingBlock(3, 'Modules'),
      tableOrParagraph(['Module', 'Capabilities', 'Requirements'], groupingRows(scope.modules), 'No modules were formed yet.'),
      headingBlock(3, 'Workstreams'),
      tableOrParagraph(['Workstream', 'Capabilities', 'Requirements'], groupingRows(scope.workstreams), 'No workstreams were formed yet.'),
      headingBlock(3, 'Delivery packages'),
      tableOrParagraph(['Delivery package', 'Capabilities', 'Suggested engagement model', 'Suggested challenge types'], deliveryPackageRows(scope.deliveryPackages), 'No delivery packages were formed yet.'),
      headingBlock(3, 'Out of scope'),
      outOfScopeBlock(scope.outOfScope),
    ],
  };
}
