/**
 * "Delivery phases and workstreams" package section (spec 6): the delivery-package groupings and
 * which workstreams run in which phase. Effort, timeline and cost numbers belong to the
 * "Effort and timeline estimate" section only - this section is purely structural.
 */
import { DELIVERY_PHASES } from '../../domain';
import type { DeliveryPackagePlan, PackageSection, ScopingSession, WorkstreamEstimate } from '../../domain';
import { headingBlock, joinOrFallback, notGeneratedCallout, refsCell, tableOrParagraph } from '../text';

const ENGAGEMENT_MODEL_TEXT: ReadonlyMap<DeliveryPackagePlan['engagementModel'], string> = new Map([
  ['topcoder-challenge-series', 'Topcoder challenge series'],
  ['dedicated-team', 'Dedicated delivery team'],
  ['blended', 'Blended (dedicated team plus challenges)'],
]);

function deliveryPackageRow(pkg: DeliveryPackagePlan): string[] {
  return [pkg.name, refsCell(pkg.capabilityIds), ENGAGEMENT_MODEL_TEXT.get(pkg.engagementModel) ?? pkg.engagementModel, joinOrFallback(pkg.suggestedChallengeTypes, 'Not yet suggested')];
}

function phaseRow(phaseId: string, phaseName: string, workstreams: readonly WorkstreamEstimate[], milestone: string | undefined): string[] {
  const names = workstreams.filter((workstream) => workstream.phaseId === phaseId).map((workstream) => workstream.name);
  return [phaseName, joinOrFallback(names, 'No workstreams planned for this phase'), milestone !== undefined && milestone.trim().length > 0 ? milestone : 'Not yet defined'];
}

export function buildDeliveryPhasesSection(session: ScopingSession): PackageSection {
  const functionalScope = session.outputs.prd.data?.functionalScope ?? null;
  const estimate = session.outputs.estimate.data?.result ?? null;

  const packagesBlock =
    functionalScope === null
      ? notGeneratedCallout('functional scope has not been generated yet, so no delivery packages are available')
      : tableOrParagraph(['Delivery package', 'Capabilities', 'Suggested engagement model', 'Suggested challenge types'], functionalScope.deliveryPackages.map(deliveryPackageRow), 'No delivery packages were formed yet.');

  const milestoneByPhase = new Map((estimate?.phases ?? []).map((phase) => [phase.id, phase.milestone]));
  const phasesBlock =
    estimate === null
      ? notGeneratedCallout('the effort and timeline estimate has not been generated yet, so phases are not yet scheduled')
      : tableOrParagraph(
          ['Phase', 'Workstreams', 'Milestone'],
          DELIVERY_PHASES.map((phase) => phaseRow(phase.id, phase.name, estimate.workstreams, milestoneByPhase.get(phase.id))),
          'No phases were planned yet.',
        );

  return {
    id: 'delivery-phases',
    title: 'Delivery phases and workstreams',
    blocks: [headingBlock(3, 'Delivery packages'), packagesBlock, headingBlock(3, 'Phases and workstreams'), phasesBlock],
  };
}
