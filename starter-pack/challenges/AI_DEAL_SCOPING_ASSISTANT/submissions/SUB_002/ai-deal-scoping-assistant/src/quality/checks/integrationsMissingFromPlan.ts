import type { EstimateResult, IntegrationSpec } from '../../domain';
import { fail, formatAmount, notGenerated } from '../checkKit';
import type { GradedFinding, QualityCheckSpec, QualityContext } from '../types';

/** Every id the delivery plan refers to: workstream requirement ids and estimate-driver refs. */
function deliveryPlanRefs(result: EstimateResult): Set<string> {
  return new Set(result.workstreams.flatMap((workstream) => [...workstream.requirementIds, ...workstream.drivers.flatMap((driver) => driver.refIds)]));
}

/** Planned = a workstream or driver cites the integration itself or one of the requirements behind it. */
function isPlanned(integration: IntegrationSpec, planRefs: ReadonlySet<string>): boolean {
  return planRefs.has(integration.id) || integration.requirementIds.some((id) => planRefs.has(id));
}

function run(context: QualityContext): GradedFinding[] {
  const { dataIntegration, estimate } = context.session.outputs;
  if (dataIntegration.data === null) {
    return [notGenerated('the integration architecture does not exist, so it cannot be compared with the delivery plan.')];
  }
  const integrations = dataIntegration.data.integrations;
  if (integrations.length === 0) {
    return [];
  }
  if (estimate.data === null) {
    return [notGenerated(`the delivery plan does not exist, so the ${formatAmount(integrations.length)} designed integrations cannot be matched to a workstream.`)];
  }
  const planRefs = deliveryPlanRefs(estimate.data.result);
  return integrations
    .filter((integration) => !isPlanned(integration, planRefs))
    .map((integration) =>
      fail(`Integration ${integration.id} "${integration.name}" with ${integration.system} is designed but no workstream or estimate driver in the delivery plan covers it, so its effort is missing from the estimate.`, [
        integration.id,
        ...integration.requirementIds,
      ]),
    );
}

export const integrationsMissingFromPlanCheck: QualityCheckSpec = {
  id: 'integrations-missing-from-plan',
  label: 'Integrations missing from the delivery plan',
  description: 'Every integration in the integration architecture is referenced by a workstream or an estimate driver of the delivery plan.',
  run,
};
