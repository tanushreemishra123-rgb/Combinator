/** Pre-computed facts and seed shapes shared by the estimate-input planner's driver builders. */
import type { EstimateContext } from '../../ai/types';
import type { CloudPlatform, Complexity, DriverType, ScopeItem } from '../../domain';
import { joinList } from '../format';
import { activeItems, distinct, indexItems } from '../scopeFacts';

/** A driver before the planner numbers it (DRV_01 ...). */
export interface DriverSeed {
  type: DriverType;
  label: string;
  complexity: Complexity;
  rationale: string;
  refIds: string[];
}

/** A workstream before the planner numbers it (WS_01 ...). */
export interface WorkstreamSeed {
  name: string;
  phaseId: string;
  drivers: DriverSeed[];
  skills: string[];
}

export interface PlannerFacts {
  context: EstimateContext;
  /** In-scope, non-rejected items of the reviewed scope model. */
  active: ScopeItem[];
  index: ReadonlyMap<string, ScopeItem>;
  platformLabel: string;
}

const PLATFORM_LABELS: ReadonlyMap<CloudPlatform, string> = new Map<CloudPlatform, string>([
  ['aws', 'AWS'],
  ['azure', 'Microsoft Azure'],
  ['gcp', 'Google Cloud'],
]);

export function createPlannerFacts(context: EstimateContext): PlannerFacts {
  const active = activeItems(context.scope);
  const platform = context.config.cloudPlatform;
  return {
    context,
    active,
    index: indexItems(active),
    platformLabel: platform === null ? 'the selected cloud platform' : (PLATFORM_LABELS.get(platform) ?? platform),
  };
}

/** Keeps only ids of active scope items, preserving order and removing duplicates. */
export function activeIds(ids: readonly string[], facts: PlannerFacts): string[] {
  return distinct(ids.filter((id) => facts.index.has(id)));
}

/** Distinct signals carried by the referenced scope items. */
export function signalsOf(ids: readonly string[], facts: PlannerFacts): string[] {
  return distinct(ids.flatMap((id) => facts.index.get(id)?.signals ?? []));
}

/** Highest band whose minimum the value reaches; bands are listed from highest to lowest. */
export function bandScore(value: number, bands: readonly { min: number; score: number }[]): number {
  return bands.find((band) => value >= band.min)?.score ?? 0;
}

export function citeIds(ids: readonly string[]): string {
  return joinList(ids);
}
