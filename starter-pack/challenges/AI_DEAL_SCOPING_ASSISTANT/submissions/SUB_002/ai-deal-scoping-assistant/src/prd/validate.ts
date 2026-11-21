/**
 * Cross-checks a PrdOutput (from the mock planner or a live provider) against the reviewed scope
 * model before it is assembled into the PRD bundle: strips references to requirement IDs the
 * scope model does not know about, flags capabilities that end up citing nothing, guarantees
 * unique capability IDs, and confirms every High-priority requirement is cited by some capability.
 */
import { formatId } from '../domain/ids';
import type { Capability, PrdOutput, ScopeModel, UserJourney, ValidationIssue } from '../domain';
import { getRequirements, knownIds } from '../scope';

interface FilterResult {
  kept: string[];
  dropped: string[];
}

function filterKnownIds(ids: readonly string[], known: ReadonlySet<string>): FilterResult {
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const id of ids) {
    if (known.has(id)) {
      kept.push(id);
    } else {
      dropped.push(id);
    }
  }
  return { kept, dropped };
}

function cleanCapability(capability: Capability, known: ReadonlySet<string>, issues: ValidationIssue[]): Capability {
  const { kept, dropped } = filterKnownIds(capability.requirementIds, known);
  if (dropped.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'unknown-reference',
      message: `Capability "${capability.name}" cited id(s) ${dropped.join(', ')} that are not in the approved in-scope model; they were removed.`,
      refs: [capability.id, ...dropped],
    });
  }
  return { ...capability, requirementIds: kept };
}

function cleanJourney(journey: UserJourney, known: ReadonlySet<string>, issues: ValidationIssue[]): UserJourney {
  const { kept, dropped } = filterKnownIds(journey.requirementIds, known);
  if (dropped.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'unknown-reference',
      message: `Journey "${journey.name}" cited id(s) ${dropped.join(', ')} that are not in the approved in-scope model; they were removed.`,
      refs: [journey.id, ...dropped],
    });
  }
  return { ...journey, requirementIds: kept };
}

/** Renumbers capabilities CAP_01.. in their existing order so ids stay unique even after a live provider re-run. */
function renumberCapabilities(capabilities: readonly Capability[]): Capability[] {
  return capabilities.map((capability, index) => ({ ...capability, id: formatId('CAP', index + 1) }));
}

/** Kept (not removed) so the coverage view can still show an unsupported addition to the reviewer. */
function flagUnsupportedCapabilities(capabilities: readonly Capability[], issues: ValidationIssue[]): void {
  for (const capability of capabilities) {
    if (capability.requirementIds.length === 0) {
      issues.push({
        severity: 'warning',
        code: 'unsupported-scope-addition',
        message: `Capability "${capability.name}" (${capability.id}) does not cite any reviewed requirement; it is shown as an unsupported scope addition.`,
        refs: [capability.id],
      });
    }
  }
}

function flagUncoveredHighPriority(scope: ScopeModel, capabilities: readonly Capability[], issues: ValidationIssue[]): void {
  const covered = new Set(capabilities.flatMap((capability) => capability.requirementIds));
  for (const requirement of getRequirements(scope)) {
    if (requirement.priority === 'High' && !covered.has(requirement.id)) {
      issues.push({
        severity: 'info',
        code: 'uncovered-high-priority',
        message: `High-priority requirement ${requirement.id} - ${requirement.title} is not cited by any capability yet.`,
        refs: [requirement.id],
      });
    }
  }
}

export interface PrdValidationResult {
  output: PrdOutput;
  issues: ValidationIssue[];
}

/** Semantically validates a PrdOutput against the reviewed scope and returns the cleaned output plus every issue raised. */
export function validatePrdOutput(output: PrdOutput, scope: ScopeModel): PrdValidationResult {
  const issues: ValidationIssue[] = [];
  const known = knownIds(scope);

  const cleanedCapabilities = renumberCapabilities(output.capabilities.map((capability) => cleanCapability(capability, known, issues)));
  const cleanedEnhancements = output.recommendedEnhancements.map((capability) => cleanCapability(capability, known, issues));
  const cleanedJourneys = output.journeys.map((journey) => cleanJourney(journey, known, issues));

  flagUnsupportedCapabilities(cleanedCapabilities, issues);
  flagUncoveredHighPriority(scope, cleanedCapabilities, issues);

  return {
    output: { ...output, capabilities: cleanedCapabilities, recommendedEnhancements: cleanedEnhancements, journeys: cleanedJourneys },
    issues,
  };
}
