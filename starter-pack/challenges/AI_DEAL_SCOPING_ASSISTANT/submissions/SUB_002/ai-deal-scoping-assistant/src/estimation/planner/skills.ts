/** Roles-and-skills recommendations per workstream family (the spec's "roles or skill categories"). */
import type { PlannerFacts } from './facts';

const MAX_NAMED_SYSTEMS = 4;

export const CAPABILITY_SKILLS: readonly string[] = [
  'UX/UI design',
  'Frontend engineering',
  'Backend and API engineering',
  'Business analysis',
  'Functional test automation',
];

export const DATA_SKILLS: readonly string[] = [
  'Data engineering and modelling',
  'Data migration and reconciliation',
  'Data quality and governance',
];

export const AI_SKILLS: readonly string[] = [
  'AI/ML engineering',
  'Prompt and retrieval engineering',
  'AI evaluation and responsible-AI guardrails',
];

const SECURITY_SKILLS: readonly string[] = [
  'Application and cloud security engineering',
  'Identity and access management',
  'Compliance evidence and audit readiness',
];

const INTEGRATION_SKILLS: readonly string[] = [
  'Integration architecture and API design',
  'Backend integration engineering',
  'Integration testing and monitoring',
];

export function securitySkills(): string[] {
  return [...SECURITY_SKILLS];
}

export function platformSkills(facts: PlannerFacts): string[] {
  const platformKnown = facts.context.config.cloudPlatform !== null;
  return [
    platformKnown ? `${facts.platformLabel} infrastructure as code` : 'Cloud infrastructure as code',
    'CI/CD and release automation',
    'Observability and site reliability',
    'Performance and resilience testing',
  ];
}

/** Names the systems to integrate with so staffing can look for that product experience. */
export function integrationSkills(facts: PlannerFacts): string[] {
  const systems = [...new Set(facts.context.integrations.map((spec) => spec.system))].slice(0, MAX_NAMED_SYSTEMS);
  return [...INTEGRATION_SKILLS, ...systems.map((system) => `${system} interface expertise`)];
}
