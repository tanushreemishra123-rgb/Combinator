/**
 * "Effort and timeline estimate" package section (spec 6): the workstream table (drivers,
 * complexity, effort range, confidence, limitations), the basis behind every driver's complexity
 * rating, the phase schedule, the reproducible calculation steps, the calculation rules every
 * number in this package traces back to, and the estimation configuration those numbers were
 * computed from - so the package alone reproduces the role split (spec success step 16).
 */
import { describeTimelineCalculation, describeTotalsCalculation, formatMoney } from '../../estimation';
import type {
  CalculationRule,
  DriverSuggestion,
  DriverType,
  EstimateDriver,
  EstimateResult,
  EstimationConfig,
  MoneyRange,
  PackageSection,
  PhaseEstimate,
  RoleId,
  RoleMixRow,
  ScopingSession,
  WorkstreamEstimate,
} from '../../domain';
import { daysRangeText, formatWhole, headingBlock, joinOrFallback, joinSentences, listBlock, notGeneratedCallout, provenanceBlock, refsCell, tableOrParagraph, weeksRangeText } from '../text';

const WORKSTREAM_COLUMNS = ['ID', 'Workstream', 'Requirements', 'Drivers', 'Complexity', 'Effort range', 'Cost (likely)', 'Confidence', 'Confidence limitations'] as const;
const DRIVER_BASIS_COLUMNS = ['Driver ID', 'Workstream', 'Type', 'Complexity', 'Basis', 'Refs'] as const;
const COMPLEXITY_COLUMNS = ['Low', 'Medium', 'High', 'Very High'] as const;

/** Rule CR_05 sizes the Discovery, Testing and Deployment overhead workstreams this way instead of drivers. */
const OVERHEAD_SIZING_LABEL = 'Percentage of build effort';
const OVERHEAD_RULE_ID = 'CR_05';
const PERCENT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** Percentage text kept local to this builder rather than pulled from the estimation engine's
 * internal formatter, which the engine does not expose outside its own module. */
function percentText(value: number): string {
  return `${PERCENT.format(Number.isFinite(value) ? value : 0)}%`;
}

const DRIVER_TYPE_TEXT: ReadonlyMap<DriverType, string> = new Map([
  ['capability', 'Capability'],
  ['integration', 'Integration'],
  ['data', 'Data'],
  ['ai', 'AI use case'],
  ['security', 'Security control'],
  ['infrastructure', 'Infrastructure'],
  ['nonFunctional', 'Non-functional hardening'],
]);

/** Same wording a driver's type carries in the Estimate Workspace, kept local so this export
 * builder does not reach into the UI layer for a seven-entry label map. */
function driverTypeText(type: DriverType): string {
  return DRIVER_TYPE_TEXT.get(type) ?? type;
}

function driverText(driver: DriverSuggestion): string {
  return `${driver.label} (${driver.complexity})`;
}

/** The 'Sized at N% of build days (CR_05)' basis for an overhead workstream, or null for a build one. */
function overheadDriversText(workstream: WorkstreamEstimate): string | null {
  const sizing = workstream.adjustments.find((adjustment) => adjustment.label === OVERHEAD_SIZING_LABEL);
  return sizing === undefined ? null : `Sized at ${percentText(sizing.factor * 100)} of build days (${OVERHEAD_RULE_ID})`;
}

/** Overhead workstreams carry no drivers by design, so their cell states what sizes them instead
 * of the generic 'No drivers identified' fallback, which reads as a missing-data artifact. */
function driversCellText(workstream: WorkstreamEstimate): string {
  if (workstream.drivers.length > 0) {
    return workstream.drivers.map(driverText).join(', ');
  }
  return overheadDriversText(workstream) ?? 'No drivers identified';
}

function workstreamCostText(cost: MoneyRange | null): string {
  return cost === null ? 'Blocked - a role rate is missing' : formatMoney(cost.likely, cost.currency);
}

function workstreamRow(workstream: WorkstreamEstimate): string[] {
  return [
    workstream.id,
    workstream.name,
    refsCell(workstream.requirementIds),
    driversCellText(workstream),
    workstream.complexity,
    daysRangeText(workstream.effortDays),
    workstreamCostText(workstream.cost),
    workstream.confidence,
    joinSentences(workstream.confidenceLimitations, 'None noted'),
  ];
}

/** One row per driver (spec 5 "Estimate Drivers"): the complexity basis and requirement refs the
 * workstream table itself has no room for, so the AI-suggested complexity behind every number is
 * explained rather than left as a bare label. */
function driverBasisRow(workstream: WorkstreamEstimate, driver: EstimateDriver): string[] {
  return [driver.id, workstream.name, driverTypeText(driver.type), driver.complexity, driver.rationale, refsCell(driver.refIds)];
}

function driverBasisRows(result: EstimateResult): string[][] {
  return result.workstreams.flatMap((workstream) => workstream.drivers.map((driver) => driverBasisRow(workstream, driver)));
}

function phaseRow(phase: PhaseEstimate): string[] {
  return [phase.name, weeksRangeText(phase.durationWeeks), `Week ${phase.startWeek}`, phase.milestone.trim().length > 0 ? phase.milestone : 'Not yet defined'];
}

function rulesRow(rule: CalculationRule): string[] {
  return [rule.id, rule.name, rule.formula, rule.description];
}

function calculationStepsBlock(steps: readonly string[]) {
  return steps.length === 0 ? { type: 'paragraph' as const, text: 'No calculation steps were recorded.' } : listBlock(steps);
}

function calculationStepBlocks(result: EstimateResult) {
  const workstreamSteps = result.workstreams.flatMap((workstream) => [headingBlock(4, `${workstream.name} calculation`), calculationStepsBlock(workstream.calculation)]);
  return [
    headingBlock(3, 'Totals calculation'),
    calculationStepsBlock(describeTotalsCalculation(result)),
    headingBlock(3, 'Timeline calculation'),
    calculationStepsBlock(describeTimelineCalculation(result, result.configSnapshot)),
    headingBlock(3, 'Per-workstream calculation steps'),
    ...workstreamSteps,
  ];
}

/** The scalar inputs every effort, timeline and ROM figure depends on (spec success step 16). */
function configScalarPairs(config: EstimationConfig) {
  return [
    { key: 'Currency', value: config.currency },
    { key: 'Contingency', value: percentText(config.contingencyPct) },
    { key: 'Productivity factor', value: config.productivityFactor.toFixed(2) },
    { key: 'Team size', value: `${config.teamSize}` },
    { key: 'Working days per week', value: `${config.workingDaysPerWeek}` },
    { key: 'Rounding unit', value: `${config.roundingUnit}` },
    { key: 'Baseline environments', value: `${config.baselineEnvironments}` },
    { key: 'Extra-environment uplift', value: percentText(config.extraEnvironmentPct) },
  ];
}

function roleLabelLookup(config: EstimationConfig): ReadonlyMap<RoleId, string> {
  return new Map(config.rates.map((rate) => [rate.roleId, rate.label]));
}

function roleMixLabel(driverType: RoleMixRow['driverType']): string {
  return driverType === 'overhead' ? 'Overhead phases' : driverTypeText(driverType);
}

function roleMixCell(row: RoleMixRow, roleLabels: ReadonlyMap<RoleId, string>): string {
  const shares = row.shares.map((share) => `${roleLabels.get(share.roleId) ?? share.roleId} ${percentText(share.pct)}`);
  return joinOrFallback(shares, 'No split defined');
}

/** Reproduces rule CR_09's role split (mix key x role %) so a reviewer does not have to back-solve
 * it from the printed role days, as the exported package alone could not do before. */
function roleMixRows(config: EstimationConfig): string[][] {
  const roleLabels = roleLabelLookup(config);
  return config.roleMix.map((row) => [roleMixLabel(row.driverType), roleMixCell(row, roleLabels)]);
}

function baseEffortRow(row: EstimationConfig['baseEffort'][number]): string[] {
  const byComplexity = new Map(row.days.map((entry) => [entry.complexity, entry.value]));
  const cells = COMPLEXITY_COLUMNS.map((complexity) => {
    const value = byComplexity.get(complexity);
    return value === undefined ? 'N/A' : `${formatWhole(value)} d`;
  });
  return [driverTypeText(row.driverType), ...cells];
}

function baseEffortRows(config: EstimationConfig): string[][] {
  return config.baseEffort.map(baseEffortRow);
}

function phaseOverheadRows(config: EstimationConfig): string[][] {
  return config.phaseOverheads.map((overhead) => [overhead.label, percentText(overhead.pctOfBuild)]);
}

function confidenceSpreadRows(config: EstimationConfig): string[][] {
  return config.confidenceSpreads.map((spread) => [spread.confidence, `-${percentText(spread.lowPct)} / +${percentText(spread.highPct)}`]);
}

/** Spec success step 16: "Reproduce the ROM estimate from visible configuration and calculation
 * factors." The role mix, base-effort table and confidence spreads are the pieces the workstream
 * table cannot show; each table is kept to one row per driver type, phase or confidence level so
 * the section reads as a compact reference rather than a wall of numbers. */
function estimationConfigurationBlocks(config: EstimationConfig) {
  return [
    headingBlock(3, 'Estimation configuration used'),
    { type: 'keyValues' as const, pairs: configScalarPairs(config) },
    tableOrParagraph(['Driver type', 'Role split'], roleMixRows(config), 'No role mix configured.'),
    tableOrParagraph(['Driver type', ...COMPLEXITY_COLUMNS], baseEffortRows(config), 'No base-effort table configured.'),
    tableOrParagraph(['Phase', 'Overhead % of build'], phaseOverheadRows(config), 'No phase overheads configured.'),
    tableOrParagraph(['Confidence', 'Variance around likely'], confidenceSpreadRows(config), 'No confidence spreads configured.'),
  ];
}

export function buildEffortTimelineSection(session: ScopingSession): PackageSection {
  const result = session.outputs.estimate.data?.result ?? null;
  if (result === null) {
    return { id: 'effort-timeline', title: 'Effort and timeline estimate', blocks: [notGeneratedCallout('the effort and timeline estimate has not been generated yet')] };
  }
  const provenance = provenanceBlock(session.outputs.estimate.meta);
  return {
    id: 'effort-timeline',
    title: 'Effort and timeline estimate',
    blocks: [
      ...(provenance === null ? [] : [provenance]),
      { type: 'keyValues', pairs: [{ key: 'Overall confidence', value: result.confidence }, { key: 'Total effort', value: daysRangeText(result.totals.effortDays) }, { key: 'Total timeline', value: weeksRangeText(result.totals.timelineWeeks) }] },
      { type: 'paragraph', text: result.deadlineAssessment.trim().length > 0 ? result.deadlineAssessment : 'No delivery deadline was configured to assess feasibility against.' },
      headingBlock(3, 'Workstreams'),
      tableOrParagraph([...WORKSTREAM_COLUMNS], result.workstreams.map(workstreamRow), 'No workstreams were suggested.'),
      headingBlock(3, 'Driver basis'),
      tableOrParagraph([...DRIVER_BASIS_COLUMNS], driverBasisRows(result), 'No drivers were suggested.'),
      headingBlock(3, 'Phases'),
      tableOrParagraph(['Phase', 'Duration', 'Start', 'Milestone'], result.phases.map(phaseRow), 'No phases were scheduled.'),
      ...calculationStepBlocks(result),
      headingBlock(3, 'Calculation rules'),
      tableOrParagraph(['Rule', 'Name', 'Formula', 'Description'], result.rules.map(rulesRow), 'No calculation rules were recorded.'),
      ...estimationConfigurationBlocks(result.configSnapshot),
    ],
  };
}
