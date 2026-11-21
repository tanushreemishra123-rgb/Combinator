/**
 * Solution and commercial configuration use cases (spec sections 3 and 5: cloud platform, users,
 * deadline, environments, rate card, contingency, currency, productivity, driver complexity). Like
 * scope edits they commit through `commitEdit`, so once deliverables exist every configuration
 * change is analysed for impact - and purely commercial changes are recalculated without AI.
 */
import type { Complexity, ComplexityOverride, EstimationConfig, RoleId, SolutionConfig } from '../../domain';
import { COMMERCIAL_PRESETS, createDefaultEstimationConfig } from '../../seed';
import { EstimationConfigSchema } from '../sessionSchema';
import type { SessionMutation, UseCaseDeps } from '../types';
import { commitEdit } from './changeFlow';
import { notify, requireActiveSession, UseCaseError } from './support';

const SOLUTION_ERROR_TITLE = 'Solution configuration could not be updated';
const COMMERCIAL_ERROR_TITLE = 'Commercial configuration could not be updated';

/**
 * First reason `config` fails `EstimationConfigSchema`, in the same "path: message" shape used for
 * a rejected import, or `null` when it is valid.
 */
function firstEstimationConfigIssue(config: EstimationConfig): string | null {
  const parsed = EstimationConfigSchema.safeParse(config);
  if (parsed.success) {
    return null;
  }
  const issue = parsed.error.issues.at(0);
  if (issue === undefined) {
    return 'an invalid commercial value';
  }
  const path = issue.path.map((segment) => String(segment)).join('.');
  return path.length === 0 ? issue.message : `${path}: ${issue.message}`;
}

/**
 * Every commercial/estimation edit is validated against the same schema a saved session must pass
 * (spec 5: an invalid value must be rejected, not silently persisted and lose the whole session on
 * the next load). Rejected edits keep the config unchanged - `commitEdit`/`runApply` surface the
 * thrown `UseCaseError` as a notice without saving.
 */
function estimationMutation(edit: (config: EstimationConfig) => EstimationConfig): SessionMutation {
  return (session) => {
    const next = edit(session.estimationConfig);
    const issue = firstEstimationConfigIssue(next);
    if (issue !== null) {
      throw new UseCaseError(`Commercial configuration rejected (${issue}). The previous value is kept.`);
    }
    return { ...session, estimationConfig: next };
  };
}

/** Cloud platform / selection mode, expected users, regions, deadline, environments, AI provider preference. */
export function updateSolutionConfig(deps: UseCaseDeps, patch: Partial<SolutionConfig>): Promise<void> {
  return commitEdit(deps, SOLUTION_ERROR_TITLE, (session) => ({ ...session, config: { ...session.config, ...patch } }));
}

/** Contingency, currency, productivity, team size and the visible baseline tables of the estimator. */
export function updateEstimationConfig(deps: UseCaseDeps, patch: Partial<EstimationConfig>): Promise<void> {
  return commitEdit(deps, COMMERCIAL_ERROR_TITLE, estimationMutation((config) => ({ ...config, ...patch })));
}

/** Sets one role's day rate; `null` means "not provided", which blocks that role's cost instead of guessing it. */
export function setRoleRate(deps: UseCaseDeps, roleId: RoleId, dayRate: number | null): Promise<void> {
  return commitEdit(
    deps,
    COMMERCIAL_ERROR_TITLE,
    estimationMutation((config) => ({ ...config, rates: config.rates.map((rate) => (rate.roleId === roleId ? { ...rate, dayRate } : rate)) })),
  );
}

/**
 * Applies an example commercial configuration. A preset is defined on top of the shipped defaults,
 * so it replaces the whole configuration - switching presets is reversible and never compounds a
 * rate multiplier that an earlier preset already applied.
 */
export async function applyCommercialPreset(deps: UseCaseDeps, presetId: string): Promise<void> {
  const preset = COMMERCIAL_PRESETS.find((candidate) => candidate.id === presetId);
  if (preset === undefined) {
    if (requireActiveSession(deps) !== null) {
      notify(deps, 'error', 'Commercial preset not found', 'That commercial configuration is not available. Choose one of the listed presets.');
    }
    return;
  }
  await commitEdit(deps, COMMERCIAL_ERROR_TITLE, estimationMutation(() => preset.apply(createDefaultEstimationConfig())));
}

/** Replaces the reviewer's override for the driver, or adds one - at most one override per driver. */
function withOverride(overrides: readonly ComplexityOverride[], driverId: string, complexity: Complexity): ComplexityOverride[] {
  const exists = overrides.some((override) => override.driverId === driverId);
  return exists ? overrides.map((override) => (override.driverId === driverId ? { driverId, complexity } : override)) : [...overrides, { driverId, complexity }];
}

/**
 * Manually sets an estimate driver's complexity. Only the override is recorded here; the change
 * flow then recalculates effort, timeline and ROM through the deterministic engine.
 */
export function setDriverComplexity(deps: UseCaseDeps, driverId: string, complexity: Complexity): Promise<void> {
  return commitEdit(deps, 'Driver complexity could not be updated', (session) => {
    const { estimate } = session.outputs;
    if (estimate.data === null) {
      throw new UseCaseError('Estimate the delivery before setting a driver complexity.');
    }
    const knownDriver = estimate.data.suggestion.workstreams.some((workstream) => workstream.drivers.some((driver) => driver.id === driverId));
    if (!knownDriver) {
      throw new UseCaseError(`The estimate has no driver ${driverId}.`);
    }
    const data = { ...estimate.data, overrides: withOverride(estimate.data.overrides, driverId, complexity) };
    return { ...session, outputs: { ...session.outputs, estimate: { ...estimate, data } } };
  });
}
