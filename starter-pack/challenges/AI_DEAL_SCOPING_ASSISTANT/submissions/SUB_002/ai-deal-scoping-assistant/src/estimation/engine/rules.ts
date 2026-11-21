/**
 * The documented calculation rules. They are attached to every EstimateResult and exported with
 * the package so a reviewer can reproduce each number from the visible drivers and configuration.
 */
import type { CalculationRule } from '../../domain';
import { formatPct } from '../format';
import { LOW_CONFIDENCE_EFFORT_SHARE, MISSING_INPUTS_FOR_LOW_CONFIDENCE } from './confidence';
import { TESTING_OVERLAP_OF_BUILD } from './timeline';

const LOW_SHARE = formatPct(LOW_CONFIDENCE_EFFORT_SHARE * 100);
const TESTING_OVERLAP = formatPct(TESTING_OVERLAP_OF_BUILD * 100);

export const CALCULATION_RULES: readonly CalculationRule[] = [
  {
    id: 'CR_01',
    name: 'Driver effort',
    formula: 'driver days = baseEffort[driver type][complexity]; complexity = reviewer override ?? AI suggestion',
    description:
      'Each scope driver is sized from the editable base-effort table. The AI only suggests the complexity level; a reviewer override replaces it and is marked user-set. A driver without a base-effort value contributes no days, is reported as a blocked scope driver and blocks the cost of its workstream and the ROM.',
  },
  {
    id: 'CR_02',
    name: 'Workstream base effort and complexity',
    formula: 'base days = sum(driver days); complexity = round(sum(level x driver days) / sum(driver days)), Low = 1 ... Very High = 4',
    description: 'A workstream is the sum of its drivers. Its complexity is the effort-weighted average of the driver complexity levels.',
  },
  {
    id: 'CR_03',
    name: 'Environment uplift',
    formula: 'infrastructure days x (1 + max(0, environments - baselineEnvironments) x extraEnvironmentPct / 100)',
    description:
      'Environments beyond the baseline add effort to infrastructure drivers only. When the number of environments is unknown, no uplift is applied, the input is listed as missing and confidence is reduced.',
  },
  {
    id: 'CR_04',
    name: 'Productivity factor',
    formula: 'likely days = round((non-infrastructure days + uplifted infrastructure days) x productivityFactor)',
    description: 'The productivity assumption scales all build effort (below 1 is faster than baseline). Likely effort is rounded to whole days.',
  },
  {
    id: 'CR_05',
    name: 'Overhead phases',
    formula: 'phase days = round(total likely build days x pctOfBuild / 100)',
    description:
      'Discovery and Architecture, Testing and Hardening, and Deployment and Handover are sized as configurable percentages of the adjusted build effort and staffed with the overhead role mix.',
  },
  {
    id: 'CR_06',
    name: 'Workstream confidence',
    formula: 'High -> Medium (Very High driver, related open gap or question, outstanding delivery dependency, missing planning input) -> Low (critical unresolved gap or question on an affected input, or a blocked calculation)',
    description:
      'Inputs map to workstreams by driver type: integration readiness -> integration, data volume -> data, AI data availability -> AI, expected users / environments / target regions -> infrastructure, compliance scope -> security, delivery deadline -> timeline. Every reduction is listed as a confidence limitation. Overhead phases inherit the overall confidence.',
  },
  {
    id: 'CR_07',
    name: 'Overall confidence',
    formula: `Low if any calculation is blocked, Low-confidence workstreams hold >= ${LOW_SHARE} of build effort, or ${MISSING_INPUTS_FOR_LOW_CONFIDENCE} or more distinct estimation inputs are missing; Medium if any workstream is below High or any input is missing; else High`,
    description: 'The overall level is weighted by effort so that one small uncertain workstream does not dominate, while blocked calculations and a largely unspecified engagement always do.',
  },
  {
    id: 'CR_08',
    name: 'Effort range',
    formula: 'low = round(likely x (1 - lowPct / 100)); high = round(likely x (1 + highPct / 100))',
    description: 'The range width comes from the confidence-spread table, so lower confidence widens the range instead of presenting unsupported precision. Totals are the sums of the workstream ranges.',
  },
  {
    id: 'CR_09',
    name: 'Role allocation',
    formula: 'role days = likely days x sum(driver-type days x role mix share) / sum(driver-type days), in tenths of a day (largest remainder)',
    description: 'Likely effort is split across roles with the role mix of each driver type, weighted by that type\'s days. Role days always add up exactly to the likely effort.',
  },
  {
    id: 'CR_10',
    name: 'Workstream cost',
    formula: 'cost = sum(role days x role day rate); range = cost x (1 - lowPct / 100) .. cost x (1 + highPct / 100)',
    description: 'A role with allocated days but no day rate, effort without a role mix, or a driver without base effort blocks the workstream cost and the ROM totals. No default rate is ever substituted.',
  },
  {
    id: 'CR_11',
    name: 'ROM commercials',
    formula: 'subtotal = roundToUnit(sum(workstream cost)); contingency = roundToUnit(subtotal x contingencyPct / 100); ROM = subtotal + contingency',
    description: 'Low, likely and high values are each rounded to the configured rounding unit and reported in the configured currency.',
  },
  {
    id: 'CR_12',
    name: 'Timeline',
    formula: 'capacity = teamSize x workingDaysPerWeek; weeks = ceil(effort / capacity); build window = ceil(sum(build phase effort) / capacity)',
    description:
      `Discovery runs first; the build phases run concurrently and share the team; Testing and Hardening may overlap the last ${TESTING_OVERLAP} of the build window but always keeps at least one week after it; Deployment and Handover runs last. The range applies the timeline confidence spread, rounded up to whole weeks.`,
  },
  {
    id: 'CR_13',
    name: 'Deadline assessment',
    formula: 'compare likely and high timeline weeks with deliveryDeadlineWeeks; required team = smallest team size whose likely timeline <= deadline',
    description: 'When no deadline is configured the assessment says so, the deadline is listed as a missing input and timeline confidence is reduced.',
  },
  {
    id: 'CR_14',
    name: 'Missing inputs',
    formula: 'missing planning input -> confidence reduced; missing day rate, role mix or base effort -> calculation blocked',
    description: 'Each missing input names the affected workstreams or estimate components, the related scope items and how to resolve it. An input held open by a gap or question is never dropped: without a workstream of its driver type it affects the workstreams that share requirements with the open item, otherwise the overall estimate.',
  },
  {
    id: 'CR_15',
    name: 'Historical references',
    formula: 'not used',
    description: 'Illustrative historical delivery references (sample data, not actual Topcoder records) are displayed for context only and are never an input to any rule above.',
  },
];
