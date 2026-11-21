/** Small presentational mappings the PRD workspace needs that the shared design system doesn't provide. */
import type { DeliveryPackagePlan, SectionStatus } from '../../domain';
import type { StatusPillStatus } from '../common';

/** A stage that is current and reviewed reads as "Reviewed"; every other status passes through unchanged. */
export function toStatusPillStatus(status: SectionStatus, reviewed: boolean): StatusPillStatus {
  return status === 'current' && reviewed ? 'reviewed' : status;
}

const ENGAGEMENT_MODEL_LABELS: ReadonlyMap<DeliveryPackagePlan['engagementModel'], string> = new Map([
  ['topcoder-challenge-series', 'Topcoder challenge series'],
  ['dedicated-team', 'Dedicated team'],
  ['blended', 'Blended (challenges + dedicated team)'],
]);

/** Readable label for how a delivery package could be executed. */
export function engagementModelLabel(model: DeliveryPackagePlan['engagementModel']): string {
  return ENGAGEMENT_MODEL_LABELS.get(model) ?? model;
}
