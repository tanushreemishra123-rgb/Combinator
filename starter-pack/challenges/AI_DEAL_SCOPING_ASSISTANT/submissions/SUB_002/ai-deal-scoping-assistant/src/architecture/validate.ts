/**
 * Semantic validation of an ArchitectureOutput (mock or live) against the ArchitectureContext it
 * was generated for. Zod already checked the shape; this checks the *content* is trustworthy:
 * every id it cites exists, every service belongs to the requested platform's catalog, every
 * component has a justification, ids are unique, and every flow endpoint is real. Problems are
 * corrected where there is an unambiguous fix and always recorded as a ValidationIssue so the
 * generation's audit trail (GenerationMeta.issues) reflects what changed and why.
 */
import type { ArchitectureContext } from '../ai/types';
import type { ArchitectureComponent, ArchitectureFlow, ArchitectureOutput, CloudPlatform, ScopeItemKind, ValidationIssue } from '../domain';
import { formatId } from '../domain';
import { getCatalogService, servicesForPlatform } from './catalog/cloudServiceCatalog.data';
import { isExternalId } from './externalRef';
import { CITABLE_REQUIREMENT_KINDS } from './justification';

const ALL_PLATFORMS: readonly CloudPlatform[] = ['aws', 'azure', 'gcp'];

/** Kinds a requirementIds citation may point at: the citable requirement kinds, plus a delivery
 *  constraint (the one exception justification.ts allows, for CI/CD and Infrastructure as Code). A
 *  persona, risk, gap, question, dependency or existing system id never belongs in requirementIds,
 *  even when the planner or a live provider mistakenly proposed one. */
const VALIDATE_CITABLE_KINDS: readonly ScopeItemKind[] = [...CITABLE_REQUIREMENT_KINDS, 'constraint'];

export interface ValidationResult {
  value: ArchitectureOutput;
  issues: ValidationIssue[];
}

function knownScopeIds(context: ArchitectureContext): Set<string> {
  return new Set(context.scope.items.map((item) => item.id));
}

function knownAssumptionIds(context: ArchitectureContext): Set<string> {
  return new Set(context.scope.items.filter((item) => item.kind === 'assumption').map((item) => item.id));
}

function scopeKindById(context: ArchitectureContext): Map<string, ScopeItemKind> {
  return new Map(context.scope.items.map((item) => [item.id, item.kind]));
}

/** Drops ids the component cites that are not in the reviewed scope, or whose kind is never a valid
 *  citation (see VALIDATE_CITABLE_KINDS), recording a warning for each. */
function dropUnknownIds(
  component: ArchitectureComponent,
  knownRequirementIds: Set<string>,
  knownAssumptions: Set<string>,
  kindById: ReadonlyMap<string, ScopeItemKind>,
  issues: ValidationIssue[],
): ArchitectureComponent {
  const requirementIds = component.requirementIds.filter((id) => {
    if (!knownRequirementIds.has(id)) {
      issues.push({ severity: 'warning', code: 'unknown-requirement-id', message: `${component.id} (${component.name}) cites unknown requirement id '${id}'; it was dropped.`, refs: [component.id] });
      return false;
    }
    const kind = kindById.get(id);
    if (kind !== undefined && !VALIDATE_CITABLE_KINDS.includes(kind)) {
      issues.push({ severity: 'warning', code: 'disallowed-citation-kind', message: `${component.id} (${component.name}) cites '${id}', which is not a requirement, technology preference or constraint; it was dropped.`, refs: [component.id] });
      return false;
    }
    return true;
  });
  const assumptionIds = component.assumptionIds.filter((id) => {
    const known = knownAssumptions.has(id);
    if (!known) {
      issues.push({ severity: 'warning', code: 'unknown-assumption-id', message: `${component.id} (${component.name}) cites unknown assumption id '${id}'; it was dropped.`, refs: [component.id] });
    }
    return known;
  });
  return { ...component, requirementIds, assumptionIds };
}

/** Corrects a service that does not belong to the requested platform's catalog entry, when known. */
function correctCrossCloudService(component: ArchitectureComponent, platform: CloudPlatform, issues: ValidationIssue[]): ArchitectureComponent {
  const expected = getCatalogService(component.logicalComponent, platform);
  if (expected === undefined) {
    const otherPlatformService = ALL_PLATFORMS.filter((candidate) => candidate !== platform).some((candidate) => servicesForPlatform(candidate).has(component.service));
    if (otherPlatformService) {
      issues.push({ severity: 'warning', code: 'cross-cloud-service', message: `${component.id} (${component.name}) proposes '${component.service}', which belongs to a different platform's catalog; the logical component is not recognized so it could not be auto-corrected.`, refs: [component.id] });
    }
    return component;
  }
  if (component.service === expected) {
    return component;
  }
  issues.push({ severity: 'warning', code: 'cross-cloud-service', message: `${component.id} (${component.name}) proposed '${component.service}' for ${platform}; corrected to the catalog service '${expected}'.`, refs: [component.id] });
  return { ...component, service: expected };
}

function flagUnjustified(component: ArchitectureComponent, issues: ValidationIssue[]): void {
  if (component.requirementIds.length === 0 && component.assumptionIds.length === 0) {
    issues.push({ severity: 'warning', code: 'unjustified-component', message: `${component.id} (${component.name}) cites no requirement, security need or reviewed assumption.`, refs: [component.id] });
  }
}

const LATER_PHASE_SUFFIX = ' (later phase)';

/** Strips the '(later phase)' suffix a related-external-system dependency may carry, so it can be
 *  matched back against the plain existingSystem title it was built from. */
function withoutLaterPhaseSuffix(dependency: string): string {
  return dependency.endsWith(LATER_PHASE_SUFFIX) ? dependency.slice(0, -LATER_PHASE_SUFFIX.length) : dependency;
}

/**
 * Flags any dependency that names neither another planned component nor a scope existingSystem -
 * the one shape of dangling reference a mechanical rule.dependencies/external-system merge could
 * otherwise leave behind un-caught (see ARC-2; the planner itself already filters both before this
 * runs, so this exists as a safety net for a live provider's output too).
 */
function flagDanglingDependencies(component: ArchitectureComponent, componentNames: ReadonlySet<string>, existingSystemTitles: ReadonlySet<string>, issues: ValidationIssue[]): void {
  for (const dependency of component.dependencies) {
    if (!componentNames.has(dependency) && !existingSystemTitles.has(withoutLaterPhaseSuffix(dependency))) {
      issues.push({ severity: 'warning', code: 'dangling-dependency', message: `${component.id} (${component.name}) lists dependency '${dependency}', which is neither a planned component nor a known external system.`, refs: [component.id] });
    }
  }
}

/** Renumbers any duplicate ARC id so every component id is unique, keeping the first occurrence. */
function dedupeIds(components: readonly ArchitectureComponent[], issues: ValidationIssue[]): ArchitectureComponent[] {
  const seen = new Set<string>();
  let nextSequence = components.length + 1;
  return components.map((component) => {
    if (!seen.has(component.id)) {
      seen.add(component.id);
      return component;
    }
    const newId = formatId('ARC', nextSequence);
    nextSequence += 1;
    issues.push({ severity: 'warning', code: 'duplicate-component-id', message: `Duplicate component id '${component.id}' on '${component.name}' was renumbered to '${newId}'.`, refs: [component.id] });
    seen.add(newId);
    return { ...component, id: newId };
  });
}

function filterKnownFlows(flows: readonly ArchitectureFlow[], componentIds: ReadonlySet<string>, issues: ValidationIssue[]): ArchitectureFlow[] {
  return flows.filter((flow) => {
    const fromKnown = componentIds.has(flow.from) || isExternalId(flow.from);
    const toKnown = componentIds.has(flow.to) || isExternalId(flow.to);
    if (!fromKnown || !toKnown) {
      issues.push({ severity: 'info', code: 'unknown-flow-endpoint', message: `Flow '${flow.label}' referenced an unknown component and was removed.`, refs: [] });
      return false;
    }
    return true;
  });
}

function correctPlatform(output: ArchitectureOutput, context: ArchitectureContext, issues: ValidationIssue[]): ArchitectureOutput {
  if (output.platform === context.platform) {
    return output;
  }
  issues.push({ severity: 'error', code: 'platform-mismatch', message: `Generated output targeted '${output.platform}' but '${context.platform}' was requested; corrected.`, refs: [] });
  return { ...output, platform: context.platform };
}

/** Validates and corrects a generated architecture against the context it was produced for. */
export function validateArchitectureOutput(output: ArchitectureOutput, context: ArchitectureContext): ValidationResult {
  const issues: ValidationIssue[] = [];
  const knownRequirementIds = knownScopeIds(context);
  const knownAssumptions = knownAssumptionIds(context);
  const kindById = scopeKindById(context);

  const corrected = correctPlatform(output, context, issues);

  let components = corrected.components.map((component) => dropUnknownIds(component, knownRequirementIds, knownAssumptions, kindById, issues));
  components = components.map((component) => correctCrossCloudService(component, corrected.platform, issues));
  const componentNames = new Set(components.map((component) => component.name));
  const existingSystemTitles = new Set(context.scope.items.filter((item) => item.kind === 'existingSystem').map((item) => item.title));
  for (const component of components) {
    flagUnjustified(component, issues);
    flagDanglingDependencies(component, componentNames, existingSystemTitles, issues);
  }
  components = dedupeIds(components, issues);

  const componentIds = new Set(components.map((component) => component.id));
  const flows = filterKnownFlows(corrected.flows, componentIds, issues);

  return { value: { ...corrected, components, flows }, issues };
}
