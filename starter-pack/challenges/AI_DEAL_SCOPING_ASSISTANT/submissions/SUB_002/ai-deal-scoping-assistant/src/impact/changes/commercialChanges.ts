/** Changes to the estimation and commercial configuration (rate card, contingency, currency, productivity). */
import type { ChangeDescriptor, EstimationConfig, RoleRate } from '../../domain';
import { formatNumber, joinList, stableFingerprint } from '../format';
import { diffFields } from './fieldRules';
import type { FieldRule } from './fieldRules';

const NO_RATE = 'no rate';

const COMMERCIAL_FIELD_RULES: readonly FieldRule<EstimationConfig>[] = [
  { kind: 'contingency', targetId: 'contingencyPct', noun: 'Contingency', describe: (config) => `${formatNumber(config.contingencyPct)}%`, magnitude: (config) => config.contingencyPct },
  { kind: 'currency', targetId: 'currency', noun: 'Currency', describe: (config) => config.currency },
  { kind: 'productivity', targetId: 'productivityFactor', noun: 'Productivity factor', describe: (config) => formatNumber(config.productivityFactor), magnitude: (config) => config.productivityFactor },
  { kind: 'productivity', targetId: 'teamSize', noun: 'Team size', describe: (config) => `${formatNumber(config.teamSize)} people`, magnitude: (config) => config.teamSize },
  { kind: 'productivity', targetId: 'workingDaysPerWeek', noun: 'Working days per week', describe: (config) => formatNumber(config.workingDaysPerWeek), magnitude: (config) => config.workingDaysPerWeek },
];

/** Baseline tables compared as a whole; the label names the tables that were edited. */
const BASELINE_TABLES: readonly { name: string; read(config: EstimationConfig): unknown }[] = [
  { name: 'base effort table', read: (config) => config.baseEffort },
  { name: 'phase overheads', read: (config) => config.phaseOverheads },
  { name: 'role mix', read: (config) => config.roleMix },
  { name: 'confidence spreads', read: (config) => config.confidenceSpreads },
  { name: 'rounding unit', read: (config) => config.roundingUnit },
  { name: 'environment baseline and uplift', read: (config) => [config.baselineEnvironments, config.extraEnvironmentPct] },
];

function describeRate(rate: RoleRate | undefined): string {
  return rate === undefined || rate.dayRate === null ? NO_RATE : formatNumber(rate.dayRate);
}

function describeRates(rates: readonly (RoleRate | undefined)[], labels: readonly string[]): string {
  return labels.map((label, index) => `${label} ${describeRate(rates.at(index))}`).join('; ');
}

/** One 'rate-card' change naming every role whose day rate was edited, added or removed. */
function describeRateCardChange(before: EstimationConfig, after: EstimationConfig): ChangeDescriptor[] {
  const roleIds = [...new Set([...before.rates, ...after.rates].map((rate) => rate.roleId))];
  const pairs = roleIds
    .map((roleId) => ({ from: before.rates.find((rate) => rate.roleId === roleId), to: after.rates.find((rate) => rate.roleId === roleId) }))
    .filter((pair) => describeRate(pair.from) !== describeRate(pair.to));
  if (pairs.length === 0) {
    return [];
  }
  const labels = pairs.map((pair) => pair.to?.label ?? pair.from?.label ?? 'Role');
  const from = describeRates(pairs.map((pair) => pair.from), labels);
  const to = describeRates(pairs.map((pair) => pair.to), labels);
  return [{ kind: 'rate-card', targetId: 'rate-card', label: `Rate card changed for ${joinList(labels)} (from ${from} to ${to})`, from, to }];
}

function describeBaselineChange(before: EstimationConfig, after: EstimationConfig): ChangeDescriptor[] {
  const edited = BASELINE_TABLES.filter((table) => stableFingerprint(table.read(before)) !== stableFingerprint(table.read(after))).map((table) => table.name);
  if (edited.length === 0) {
    return [];
  }
  const names = joinList(edited);
  return [{ kind: 'productivity', targetId: 'estimation-baseline', label: `Estimation baseline changed: ${names}`, from: `previous ${names}`, to: `edited ${names}` }];
}

export function describeCommercialChanges(before: EstimationConfig, after: EstimationConfig): ChangeDescriptor[] {
  return [...describeRateCardChange(before, after), ...diffFields(COMMERCIAL_FIELD_RULES, before, after), ...describeBaselineChange(before, after)];
}
