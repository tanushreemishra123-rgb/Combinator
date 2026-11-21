import { servicesForPlatform } from '../../architecture';
import { getItemsByKind } from '../../scope';
import { CloudPlatformSchema, signalLabel } from '../../domain';
import type { ArchitectureDesign, CloudPlatform, ScopeItem } from '../../domain';
import { fail, nameItem, notGenerated, warn } from '../checkKit';
import type { GradedFinding, QualityCheckSpec, QualityContext } from '../types';

const PLATFORMS: readonly CloudPlatform[] = CloudPlatformSchema.options;

function platformName(platform: CloudPlatform): string {
  return signalLabel(`cloud:${platform}`);
}

/** The platform another catalog attributes a service to, unless the selected platform offers it too. */
function foreignPlatformOf(service: string, selected: CloudPlatform): CloudPlatform | undefined {
  if (servicesForPlatform(selected).has(service)) {
    return undefined;
  }
  return PLATFORMS.find((platform) => platform !== selected && servicesForPlatform(platform).has(service));
}

function selectionConflict(context: QualityContext, architecture: ArchitectureDesign): GradedFinding[] {
  const { cloudPlatform, cloudSelectionMode } = context.session.config;
  if (cloudSelectionMode !== 'user-selected' || cloudPlatform === null || cloudPlatform === architecture.platform) {
    return [];
  }
  return [fail(`The configuration selects ${platformName(cloudPlatform)}, but the solution architecture was designed for ${platformName(architecture.platform)}.`)];
}

function foreignServiceFinding(owner: string, service: string, selected: CloudPlatform, ref: string): GradedFinding[] {
  const foreign = foreignPlatformOf(service, selected);
  return foreign === undefined ? [] : [fail(`${owner} uses ${service}, a ${platformName(foreign)} service, in a ${platformName(selected)} architecture.`, [ref])];
}

function serviceConflicts(context: QualityContext, architecture: ArchitectureDesign): GradedFinding[] {
  const selected = architecture.platform;
  const topics = context.session.outputs.dataIntegration.data?.topics ?? [];
  return [
    ...architecture.components.flatMap((component) => foreignServiceFinding(`Architecture component ${component.id} "${component.name}"`, component.service, selected, component.id)),
    ...topics.flatMap((plan) => plan.services.flatMap((service) => foreignServiceFinding(`The "${plan.topic}" data topic`, service, selected, plan.topic))),
  ];
}

function namedPlatforms(item: ScopeItem): CloudPlatform[] {
  return PLATFORMS.filter((platform) => item.signals.includes(`cloud:${platform}`));
}

/** A technology preference that names only other clouds contradicts the selection and needs a decision. */
function preferenceConflicts(context: QualityContext, selected: CloudPlatform): GradedFinding[] {
  if (context.scope === null) {
    return [];
  }
  return getItemsByKind(context.scope, 'technology')
    .filter((item) => item.inScope && namedPlatforms(item).length > 0 && !namedPlatforms(item).includes(selected))
    .map((item) =>
      warn(`Technology preference ${nameItem(item)} names ${namedPlatforms(item).map(platformName).join(' and ')}, but the selected platform is ${platformName(selected)}.`, [item.id]),
    );
}

function run(context: QualityContext): GradedFinding[] {
  const architecture = context.session.outputs.architecture.data;
  const selected = architecture?.platform ?? context.session.config.cloudPlatform;
  const preferences = selected === null ? [] : preferenceConflicts(context, selected);
  if (architecture === null) {
    return [notGenerated('the solution architecture does not exist, so cloud services cannot be checked against the selected platform.'), ...preferences];
  }
  return [...selectionConflict(context, architecture), ...serviceConflicts(context, architecture), ...preferences];
}

export const conflictingCloudSelectionCheck: QualityCheckSpec = {
  id: 'conflicting-cloud-selection',
  label: 'Conflicting cloud selections or technologies',
  description: 'The configured platform, the designed architecture, every named cloud service and the stated technology preferences agree on one cloud platform.',
  run,
};
