/**
 * Secondary grounding source: user-provided context, assumptions and commercial configuration.
 * Every numeric value used by the estimator lives here so results are reproducible.
 */
import type { CloudPlatform, Complexity, Confidence } from './common';

export interface CustomerContext {
  customerName: string;
  industry: string;
  opportunityName: string;
  region: string;
  engagementType: string;
  notes: string;
}

export type AiProviderPreference = 'cloud-native' | 'openai' | 'anthropic' | 'open-source' | 'no-preference';

export interface SolutionConfig {
  cloudPlatform: CloudPlatform | null;
  /** 'recommend' lets the assistant pick the platform from requirement signals. */
  cloudSelectionMode: 'user-selected' | 'recommend';
  expectedUsers: number | null;
  targetRegions: string[];
  deliveryDeadlineWeeks: number | null;
  environments: number | null;
  aiProviderPreference: AiProviderPreference;
}

export type RoleId =
  | 'engagement-manager'
  | 'solution-architect'
  | 'business-analyst'
  | 'ux-designer'
  | 'frontend-engineer'
  | 'backend-engineer'
  | 'data-engineer'
  | 'ai-engineer'
  | 'devops-engineer'
  | 'security-engineer'
  | 'qa-engineer';

export interface RoleRate {
  roleId: RoleId;
  label: string;
  /** Day rate in the configured currency. null = not provided -> cost for this role is blocked. */
  dayRate: number | null;
}

export type DriverType =
  | 'capability'
  | 'integration'
  | 'data'
  | 'ai'
  | 'security'
  | 'infrastructure'
  | 'nonFunctional';

export interface BaseEffortRow {
  driverType: DriverType;
  label: string;
  /** Person-days per unit for each complexity level. */
  days: { complexity: Complexity; value: number }[];
}

export interface PhaseOverhead {
  phaseId: string;
  label: string;
  /** Overhead expressed as a percentage of total build effort. */
  pctOfBuild: number;
}

export interface RoleMixRow {
  driverType: DriverType | 'overhead';
  shares: { roleId: RoleId; pct: number }[];
}

export interface ConfidenceSpread {
  confidence: Confidence;
  /** Range applied around the likely value: low = likely*(1-lowPct), high = likely*(1+highPct). */
  lowPct: number;
  highPct: number;
}

export interface EstimationConfig {
  currency: string;
  contingencyPct: number;
  /** <1 means faster than baseline (e.g. 0.9 for AI-assisted delivery), >1 slower. */
  productivityFactor: number;
  workingDaysPerWeek: number;
  /** Average number of people working in parallel - converts effort into calendar time. */
  teamSize: number;
  /** ROM totals are rounded to this value to avoid presenting unsupported precision. */
  roundingUnit: number;
  baselineEnvironments: number;
  extraEnvironmentPct: number;
  rates: RoleRate[];
  baseEffort: BaseEffortRow[];
  phaseOverheads: PhaseOverhead[];
  roleMix: RoleMixRow[];
  confidenceSpreads: ConfidenceSpread[];
}
