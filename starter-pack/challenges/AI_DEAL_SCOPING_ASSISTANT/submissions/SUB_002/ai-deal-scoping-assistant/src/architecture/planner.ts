/**
 * Deterministic (mock) architecture planner: walks the foundation + conditional rule tables in
 * componentRules.data.ts, resolves each proposed component's citation via justification.ts, and
 * assembles the full ArchitectureOutput (components, flows, environments and the narrative
 * sections). This is what the mock AI provider calls for the 'design-architecture' task, and it is
 * exercised by the same Zod schema a live provider's JSON response is validated against.
 */
import type { ArchitectureContext } from '../ai/types';
import type { ArchitectureArea, ArchitectureComponent, ArchitectureOutput, CloudPlatform, ScopeItem, ScopeModel } from '../domain';
import { formatId } from '../domain';
import { getCatalogEntry, getCatalogService } from './catalog/cloudServiceCatalog.data';
import { CONDITIONAL_RULES, COMPONENT_NAMES, FOUNDATION_RULES, type ConditionalRule, type FoundationRule } from './componentRules.data';
import { buildEnvironments } from './environments';
import { buildFlows } from './flows';
import { gapOnlyTrigger, isLowConfidenceJustification, justifyConditional, justifyFoundation, type Justification } from './justification';
import { buildAvailabilityStatements, buildBackupDrStatements, buildDeploymentStatements, buildSecurityStatements, buildSummary, type PendingGapNote } from './narrative';
import { formatList, isInternalOnlyAudience, relatedExternalSystemTitles } from './scopeQueries';

interface PlannedComponent {
  key: string;
  component: ArchitectureComponent;
  /** The rule's own dependencies field, as authored - kept unfiltered until every component this
   *  run will plan is known, so a dependency can be checked against the final planned set instead
   *  of only the components planned before it in rule-table order (see ARC-2). */
  staticDependencies: readonly string[];
}

/** Rule keys whose whole purpose is exchanging data with external systems, so listing a related
 *  external system as a dependency is expected and informative rather than mechanical fan-out. Any
 *  other component only lists an external system when the specific item that cites it is itself an
 *  integration requirement (see externalSystemCitingItems). */
const INTEGRATION_AREA_RULE_KEYS: ReadonlySet<string> = new Set([
  'integration-api-management',
  'integration-service',
  'message-queue',
  'event-bus',
  'sftp-file-transfer',
  'etl-pipeline',
  'scheduler',
]);

/** The citing items eligible to add a related external system to a component's dependencies: every
 *  citing item for an integration-area component, otherwise only the citing items that are
 *  themselves integration requirements. This is what stops, e.g., Key Management from listing a
 *  clinical HIE as a "dependency" purely because some unrelated citing item shares a signal with it. */
function externalSystemCitingItems(ruleKey: string, justification: Justification): readonly ScopeItem[] {
  return INTEGRATION_AREA_RULE_KEYS.has(ruleKey) ? justification.items : justification.items.filter((item) => item.kind === 'integration');
}

interface ConditionalPlanResult {
  planned: PlannedComponent[];
  pendingGaps: PendingGapNote[];
}

/**
 * States the concrete service feature first, then the ids it addresses (spec section 3 example).
 * Rule fragments are verb phrases ("aggregates metrics..."), so the service is their subject.
 */
function buildRationale(service: string, justification: Justification, rationaleFragment: string): string {
  const loweredFragment = rationaleFragment.charAt(0).toLowerCase() + rationaleFragment.slice(1);
  const feature = `${service} ${loweredFragment}.`;
  if (justification.requirementIds.length > 0) {
    return `${feature} It addresses ${formatList(justification.requirementIds)}.`;
  }
  if (justification.assumptionIds.length > 0) {
    return `${feature} It is grounded in reviewed assumption ${formatList(justification.assumptionIds)}.`;
  }
  return feature;
}

type RuleShape = Pick<FoundationRule, 'logicalComponent' | 'name' | 'purpose' | 'rationaleFragment' | 'tradeOffs' | 'dependencies' | 'securityConsiderations'>;

/** Resolves a foundation rule's displayed purpose/rationale, swapping in the internal-audience
 *  variant (see componentRules.data.ts internalAudienceText) once every reviewed persona is staff. */
function resolveFoundationRule(rule: FoundationRule, isInternalOnly: boolean): RuleShape {
  const overrides = isInternalOnly ? rule.internalAudienceText : undefined;
  return {
    logicalComponent: rule.logicalComponent,
    name: rule.name,
    purpose: overrides?.purpose ?? rule.purpose,
    rationaleFragment: overrides?.rationaleFragment ?? rule.rationaleFragment,
    tradeOffs: rule.tradeOffs,
    dependencies: rule.dependencies,
    securityConsiderations: rule.securityConsiderations,
  };
}

/** Builds a component's own fields plus its unfiltered static dependency names - null when the
 *  platform's catalog has no service for this logical component at all. */
interface BuiltComponent {
  component: ArchitectureComponent;
  staticDependencies: readonly string[];
}

function buildComponent(platform: CloudPlatform, area: ArchitectureArea, ruleKey: string, rule: RuleShape, justification: Justification, scope: ScopeModel): BuiltComponent | null {
  const service = getCatalogService(rule.logicalComponent, platform);
  if (service === undefined) {
    return null;
  }
  const externalSystemTitles = relatedExternalSystemTitles(scope, externalSystemCitingItems(ruleKey, justification));
  const component: ArchitectureComponent = {
    id: '',
    name: rule.name,
    area,
    logicalComponent: rule.logicalComponent,
    service,
    requirementIds: justification.requirementIds,
    assumptionIds: justification.assumptionIds,
    purpose: rule.purpose,
    rationale: buildRationale(service, justification, rule.rationaleFragment),
    tradeOffs: [...rule.tradeOffs],
    dependencies: [...new Set(externalSystemTitles)],
    securityConsiderations: [...rule.securityConsiderations],
  };
  return { component, staticDependencies: rule.dependencies };
}

/** Sentence appended when every citing item is Low-priority or still undefined (spec section 3
 *  finding: a heavyweight component should not be committed outright to an unconfirmed ask). */
function lightweightTradeOff(alternative: string): string {
  return `The driving requirement is Low-priority and not yet fully defined; ${alternative} would be sufficient until it is confirmed, rather than committing to this component now.`;
}

function withLightweightTradeOff(component: ArchitectureComponent, scope: ScopeModel, justification: Justification, rule: ConditionalRule): ArchitectureComponent {
  if (rule.lightweightAlternative === undefined || !isLowConfidenceJustification(scope, justification.items)) {
    return component;
  }
  return { ...component, tradeOffs: [...component.tradeOffs, lightweightTradeOff(rule.lightweightAlternative)] };
}

function planFoundationComponents(context: ArchitectureContext, isInternalOnly: boolean): PlannedComponent[] {
  const planned: PlannedComponent[] = [];
  for (const rule of FOUNDATION_RULES) {
    const justification = justifyFoundation(context.scope, rule);
    const area = getCatalogEntry(rule.logicalComponent)?.area;
    if (justification === null || area === undefined) {
      continue;
    }
    const built = buildComponent(context.platform, area, rule.key, resolveFoundationRule(rule, isInternalOnly), justification, context.scope);
    if (built !== null) {
      planned.push({ key: rule.key, component: built.component, staticDependencies: built.staticDependencies });
    }
  }
  return planned;
}

function planConditionalComponents(context: ArchitectureContext): ConditionalPlanResult {
  const planned: PlannedComponent[] = [];
  const pendingGaps: PendingGapNote[] = [];
  for (const rule of CONDITIONAL_RULES) {
    const justification = justifyConditional(context.scope, context.config, rule);
    if (justification === null) {
      const gap = gapOnlyTrigger(context.scope, context.config, rule);
      if (gap !== null) {
        pendingGaps.push({ componentName: rule.name, gapId: gap.id, gapTitle: gap.title });
      }
      continue;
    }
    const area = getCatalogEntry(rule.logicalComponent)?.area;
    if (area === undefined) {
      continue;
    }
    const built = buildComponent(context.platform, area, rule.key, rule, justification, context.scope);
    if (built !== null) {
      planned.push({ key: rule.key, component: withLightweightTradeOff(built.component, context.scope, justification, rule), staticDependencies: built.staticDependencies });
    }
  }
  return { planned, pendingGaps };
}

function assignSequentialIds(planned: readonly PlannedComponent[]): PlannedComponent[] {
  return planned.map((entry, index) => ({ ...entry, component: { ...entry.component, id: formatId('ARC', index + 1) } }));
}

/** Merges the rule-authored dependencies into a component's final list, keeping only the ones that
 *  point at a component actually planned in this run (Set.has) - the related-external-system names
 *  already baked into `component.dependencies` need no such check, since they always name a real
 *  scope existingSystem (see buildComponent/externalSystemCitingItems). Fixes the dangling
 *  dependencies a purely mechanical rule.dependencies merge could otherwise produce (ARC-2). */
function withFilteredStaticDependencies(entry: PlannedComponent, plannedComponentNames: ReadonlySet<string>): ArchitectureComponent {
  const validStaticDependencies = entry.staticDependencies.filter((name) => plannedComponentNames.has(name));
  return { ...entry.component, dependencies: [...new Set([...validStaticDependencies, ...entry.component.dependencies])] };
}

/** Used only when a truly empty, unreviewed scope leaves no component justified (edge case). */
function buildBaselineComponent(platform: CloudPlatform): PlannedComponent {
  const service = getCatalogService('container-runtime', platform) ?? 'Managed container runtime';
  const component: ArchitectureComponent = {
    id: formatId('ARC', 1),
    name: COMPONENT_NAMES.computeRuntime,
    area: 'backend',
    logicalComponent: 'container-runtime',
    service,
    requirementIds: [],
    assumptionIds: [],
    purpose: 'Baseline compute placeholder proposed before any requirement has been reviewed and approved.',
    rationale: `${service} is proposed as a starting point. No reviewed scope item exists yet to justify a specific component; revisit this baseline once requirements are captured, reviewed and approved.`,
    tradeOffs: ['This is a placeholder, not a scoped recommendation - every component should be revisited once requirements exist.'],
    dependencies: [],
    securityConsiderations: [],
  };
  return { key: 'compute-runtime', component, staticDependencies: [] };
}

/**
 * Builds the full solution architecture for the platform already resolved in `context.platform`.
 * Never throws: an empty or minimally-populated scope yields a smaller, still valid, architecture.
 */
export function planArchitecture(context: ArchitectureContext): ArchitectureOutput {
  const isInternalOnly = isInternalOnlyAudience(context.scope);
  const foundation = planFoundationComponents(context, isInternalOnly);
  const conditional = planConditionalComponents(context);
  const planned = [...foundation, ...conditional.planned];
  const withIds = assignSequentialIds(planned.length > 0 ? planned : [buildBaselineComponent(context.platform)]);
  const plannedComponentNames = new Set(withIds.map((entry) => entry.component.name));
  const finalized = withIds.map((entry) => ({ key: entry.key, component: withFilteredStaticDependencies(entry, plannedComponentNames) }));

  const components = finalized.map((entry) => entry.component);
  const componentsByKey = new Map(finalized.map((entry) => [entry.key, entry.component]));
  const environments = buildEnvironments(context.config, context.scope);

  return {
    platform: context.platform,
    summary: buildSummary(context.platform, components, context.capabilities, conditional.pendingGaps),
    components,
    flows: buildFlows(componentsByKey, context.scope),
    environments,
    deployment: buildDeploymentStatements(componentsByKey, environments),
    availability: buildAvailabilityStatements(componentsByKey),
    backupDr: buildBackupDrStatements(componentsByKey),
    securityControls: buildSecurityStatements(componentsByKey, isInternalOnly),
  };
}
