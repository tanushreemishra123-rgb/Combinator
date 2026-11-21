/** Changes to the solution configuration (cloud platform, user volume, deadline, regions, AI provider). */
import { signalLabel } from '../../domain';
import type { AiProviderPreference, ChangeDescriptor, SolutionConfig } from '../../domain';
import { formatNumber, joinList, pick } from '../format';
import { diffFields, NOT_SPECIFIED } from './fieldRules';
import type { FieldRule } from './fieldRules';

const AI_PROVIDER_LABELS: ReadonlyMap<AiProviderPreference, string> = new Map([
  ['cloud-native', 'cloud-native AI services'],
  ['openai', 'OpenAI models'],
  ['anthropic', 'Anthropic models'],
  ['open-source', 'open-source models'],
  ['no-preference', 'no provider preference'],
]);

const RECOMMENDED_PLATFORM = 'the assistant-recommended platform';

/** A manually selected platform by name; otherwise the recommendation mode. */
function describePlatform(config: SolutionConfig): string {
  if (config.cloudSelectionMode === 'recommend' || config.cloudPlatform === null) {
    return RECOMMENDED_PLATFORM;
  }
  return signalLabel(`cloud:${config.cloudPlatform}`);
}

function describeCount(value: number | null, singular: string, plural: string): string {
  return value === null ? NOT_SPECIFIED : `${formatNumber(value)} ${pick(singular, plural, value)}`;
}

const SOLUTION_FIELD_RULES: readonly FieldRule<SolutionConfig>[] = [
  { kind: 'cloud-platform', targetId: 'cloudPlatform', noun: 'Cloud platform', describe: describePlatform },
  {
    kind: 'expected-users',
    targetId: 'expectedUsers',
    noun: 'Expected users',
    describe: (config) => (config.expectedUsers === null ? NOT_SPECIFIED : formatNumber(config.expectedUsers)),
    magnitude: (config) => config.expectedUsers,
  },
  {
    kind: 'delivery-deadline',
    targetId: 'deliveryDeadlineWeeks',
    noun: 'Delivery deadline',
    describe: (config) => describeCount(config.deliveryDeadlineWeeks, 'week', 'weeks'),
  },
  {
    kind: 'environments',
    targetId: 'environments',
    noun: 'Number of environments',
    describe: (config) => describeCount(config.environments, 'environment', 'environments'),
    magnitude: (config) => config.environments,
  },
  {
    kind: 'target-regions',
    targetId: 'targetRegions',
    noun: 'Target regions',
    describe: (config) => (config.targetRegions.length === 0 ? NOT_SPECIFIED : joinList(config.targetRegions)),
  },
  {
    kind: 'ai-provider-preference',
    targetId: 'aiProviderPreference',
    noun: 'AI-provider preference',
    describe: (config) => AI_PROVIDER_LABELS.get(config.aiProviderPreference) ?? config.aiProviderPreference,
  },
];

export function describeConfigChanges(before: SolutionConfig, after: SolutionConfig): ChangeDescriptor[] {
  return diffFields(SOLUTION_FIELD_RULES, before, after);
}
