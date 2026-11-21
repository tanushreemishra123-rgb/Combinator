/**
 * Default, fully editable estimation and commercial configuration.
 * These are illustrative planning values (not a price list); every number is visible and editable
 * in the Estimate Workspace and is echoed in the exported package so the ROM can be reproduced.
 */
import type { Complexity, EstimationConfig, RoleRate, SolutionConfig } from '../domain';

const COMPLEXITIES: readonly Complexity[] = ['Low', 'Medium', 'High', 'Very High'];

/** Builds the per-complexity person-day row in Low -> Very High order. */
function effortRow(values: readonly [number, number, number, number]): { complexity: Complexity; value: number }[] {
  return COMPLEXITIES.map((complexity, index) => ({ complexity, value: values.at(index) ?? 0 }));
}

/** Example role-based day rates in USD. */
export const DEFAULT_ROLE_RATES: readonly RoleRate[] = [
  { roleId: 'engagement-manager', label: 'Engagement Manager', dayRate: 950 },
  { roleId: 'solution-architect', label: 'Solution Architect', dayRate: 1100 },
  { roleId: 'business-analyst', label: 'Business Analyst', dayRate: 750 },
  { roleId: 'ux-designer', label: 'UX/UI Designer', dayRate: 700 },
  { roleId: 'frontend-engineer', label: 'Frontend Engineer', dayRate: 720 },
  { roleId: 'backend-engineer', label: 'Backend Engineer', dayRate: 760 },
  { roleId: 'data-engineer', label: 'Data Engineer', dayRate: 800 },
  { roleId: 'ai-engineer', label: 'AI/ML Engineer', dayRate: 980 },
  { roleId: 'devops-engineer', label: 'Cloud/DevOps Engineer', dayRate: 820 },
  { roleId: 'security-engineer', label: 'Security Engineer', dayRate: 900 },
  { roleId: 'qa-engineer', label: 'QA Engineer', dayRate: 600 },
];

export function createDefaultEstimationConfig(): EstimationConfig {
  return {
    currency: 'USD',
    contingencyPct: 15,
    productivityFactor: 1,
    workingDaysPerWeek: 5,
    teamSize: 6,
    roundingUnit: 1000,
    baselineEnvironments: 3,
    extraEnvironmentPct: 5,
    rates: DEFAULT_ROLE_RATES.map((rate) => ({ ...rate })),
    baseEffort: [
      { driverType: 'capability', label: 'Functional capability', days: effortRow([8, 15, 25, 40]) },
      { driverType: 'integration', label: 'System integration', days: effortRow([6, 12, 22, 35]) },
      { driverType: 'data', label: 'Data domain / migration', days: effortRow([6, 12, 20, 32]) },
      { driverType: 'ai', label: 'AI use case', days: effortRow([10, 18, 30, 45]) },
      { driverType: 'security', label: 'Security / compliance control', days: effortRow([4, 8, 14, 22]) },
      { driverType: 'infrastructure', label: 'Cloud infrastructure', days: effortRow([5, 10, 16, 25]) },
      { driverType: 'nonFunctional', label: 'Non-functional hardening', days: effortRow([3, 6, 10, 16]) },
    ],
    phaseOverheads: [
      { phaseId: 'PH_1', label: 'Discovery and Architecture', pctOfBuild: 12 },
      { phaseId: 'PH_5', label: 'Testing and Hardening', pctOfBuild: 22 },
      { phaseId: 'PH_6', label: 'Deployment and Handover', pctOfBuild: 8 },
    ],
    roleMix: [
      {
        driverType: 'capability',
        shares: [
          { roleId: 'frontend-engineer', pct: 35 },
          { roleId: 'backend-engineer', pct: 35 },
          { roleId: 'ux-designer', pct: 10 },
          { roleId: 'qa-engineer', pct: 10 },
          { roleId: 'business-analyst', pct: 5 },
          { roleId: 'solution-architect', pct: 5 },
        ],
      },
      {
        driverType: 'integration',
        shares: [
          { roleId: 'backend-engineer', pct: 55 },
          { roleId: 'data-engineer', pct: 15 },
          { roleId: 'qa-engineer', pct: 15 },
          { roleId: 'solution-architect', pct: 10 },
          { roleId: 'devops-engineer', pct: 5 },
        ],
      },
      {
        driverType: 'data',
        shares: [
          { roleId: 'data-engineer', pct: 60 },
          { roleId: 'backend-engineer', pct: 15 },
          { roleId: 'qa-engineer', pct: 10 },
          { roleId: 'solution-architect', pct: 10 },
          { roleId: 'security-engineer', pct: 5 },
        ],
      },
      {
        driverType: 'ai',
        shares: [
          { roleId: 'ai-engineer', pct: 55 },
          { roleId: 'backend-engineer', pct: 15 },
          { roleId: 'data-engineer', pct: 10 },
          { roleId: 'qa-engineer', pct: 10 },
          { roleId: 'solution-architect', pct: 10 },
        ],
      },
      {
        driverType: 'security',
        shares: [
          { roleId: 'security-engineer', pct: 50 },
          { roleId: 'devops-engineer', pct: 20 },
          { roleId: 'backend-engineer', pct: 20 },
          { roleId: 'solution-architect', pct: 10 },
        ],
      },
      {
        driverType: 'infrastructure',
        shares: [
          { roleId: 'devops-engineer', pct: 65 },
          { roleId: 'solution-architect', pct: 15 },
          { roleId: 'security-engineer', pct: 10 },
          { roleId: 'backend-engineer', pct: 10 },
        ],
      },
      {
        driverType: 'nonFunctional',
        shares: [
          { roleId: 'backend-engineer', pct: 35 },
          { roleId: 'qa-engineer', pct: 30 },
          { roleId: 'devops-engineer', pct: 25 },
          { roleId: 'solution-architect', pct: 10 },
        ],
      },
      {
        driverType: 'overhead',
        shares: [
          { roleId: 'engagement-manager', pct: 30 },
          { roleId: 'solution-architect', pct: 25 },
          { roleId: 'qa-engineer', pct: 20 },
          { roleId: 'business-analyst', pct: 15 },
          { roleId: 'devops-engineer', pct: 10 },
        ],
      },
    ],
    confidenceSpreads: [
      { confidence: 'High', lowPct: 10, highPct: 15 },
      { confidence: 'Medium', lowPct: 15, highPct: 30 },
      { confidence: 'Low', lowPct: 20, highPct: 50 },
    ],
  };
}

/** Nothing is assumed up front: unknown inputs stay null so the estimator can flag them. */
export function createDefaultSolutionConfig(): SolutionConfig {
  return {
    cloudPlatform: null,
    cloudSelectionMode: 'recommend',
    expectedUsers: null,
    targetRegions: [],
    deliveryDeadlineWeeks: null,
    environments: null,
    aiProviderPreference: 'no-preference',
  };
}
