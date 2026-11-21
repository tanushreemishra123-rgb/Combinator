/**
 * Semantic validation of AI-suggested estimate inputs (after Zod has validated the structure).
 * Unknown references are dropped, phases are forced into the build phases, ids are made unique and
 * any effort / duration / cost figure in the AI's prose is removed - the AI never supplies numbers.
 */
import type { EstimateContext } from '../ai/types';
import { formatId } from '../domain';
import type { DriverSuggestion, EstimateNote, EstimateSuggestion, ValidationIssue, WorkstreamSuggestion } from '../domain';
import { isBuildPhase, phaseForDriverType } from './phases';
import { activeItems } from './scopeFacts';

const DURATION_FIGURE = /\d\s*(?:person[- ]?|man[- ]?)?(?:days?|weeks?|months?|hours?|sprints?)\b/i;
const MONEY_FIGURE = /[$€£]\s?\d|\d\s?(?:usd|eur|gbp)\b/i;
const SENTENCE_BREAK = /(?<=[.!?])\s+/;
const FALLBACK_RATIONALE = 'Complexity suggested by the AI provider from the referenced scope items; the effort is calculated from the base-effort table.';

export interface SuggestionValidation {
  suggestion: EstimateSuggestion;
  issues: ValidationIssue[];
}

/** True when the text states an effort, duration or money figure. */
export function containsEffortOrCostFigure(text: string): boolean {
  return DURATION_FIGURE.test(text) || MONEY_FIGURE.test(text);
}

function warning(code: string, message: string, refs: string[]): ValidationIssue {
  return { severity: 'warning', code, message, refs };
}

/** Removes the sentences that state figures; the rest of the text is kept unchanged. */
function stripFigures(text: string, fallback: string): { text: string; changed: boolean } {
  if (!containsEffortOrCostFigure(text)) {
    return { text, changed: false };
  }
  const kept = text.split(SENTENCE_BREAK).filter((sentence) => !containsEffortOrCostFigure(sentence));
  return { text: kept.length > 0 ? kept.join(' ') : fallback, changed: true };
}

/** Ids referenceable from the estimate: active scope items and the upstream deliverables' elements. */
function knownReferenceIds(context: EstimateContext): Set<string> {
  return new Set([
    ...activeItems(context.scope).map((item) => item.id),
    ...context.capabilities.map((capability) => capability.id),
    ...context.components.map((component) => component.id),
    ...context.integrations.map((spec) => spec.id),
    ...context.aiUseCases.map((useCase) => useCase.id),
  ]);
}

/**
 * Keeps the first use of an id; later duplicates (or blanks) get the next free structured id.
 * Replacement ids avoid every id of the raw suggestion so one duplicate never cascades.
 */
function createIdAllocator(prefix: string, rawIds: readonly string[]): (id: string) => { id: string; replaced: boolean } {
  const reserved = new Set(rawIds.map((id) => id.trim()));
  const used = new Set<string>();
  let sequence = 0;
  const nextFreeId = (): string => {
    let candidate = '';
    while (candidate === '' || used.has(candidate) || reserved.has(candidate)) {
      sequence += 1;
      candidate = formatId(prefix, sequence);
    }
    return candidate;
  };
  return (id) => {
    const wanted = id.trim();
    const replaced = wanted === '' || used.has(wanted);
    const allocated = replaced ? nextFreeId() : wanted;
    used.add(allocated);
    return { id: allocated, replaced };
  };
}

interface ValidationState {
  known: Set<string>;
  issues: ValidationIssue[];
  driverId: ReturnType<typeof createIdAllocator>;
  workstreamId: ReturnType<typeof createIdAllocator>;
}

function keepKnown(ids: readonly string[], ownerId: string, state: ValidationState): string[] {
  const unknown = ids.filter((id) => !state.known.has(id));
  if (unknown.length > 0) {
    state.issues.push(
      warning('estimate.unknown-reference', `${ownerId} referenced ids that are not in the reviewed scope or its deliverables (${unknown.join(', ')}); they were dropped.`, [ownerId]),
    );
  }
  return [...new Set(ids.filter((id) => state.known.has(id)))];
}

function validateDriver(driver: DriverSuggestion, state: ValidationState): DriverSuggestion {
  const allocated = state.driverId(driver.id);
  if (allocated.replaced) {
    state.issues.push(warning('estimate.duplicate-id', `Driver id ${driver.id} was already used; "${driver.label}" was renumbered to ${allocated.id}.`, [allocated.id]));
  }
  const rationale = stripFigures(driver.rationale, FALLBACK_RATIONALE);
  if (rationale.changed) {
    state.issues.push(warning('estimate.figure-removed', `${allocated.id} stated an effort or cost figure in its rationale; it was removed because numbers come only from the calculation engine.`, [allocated.id]));
  }
  const refIds = keepKnown(driver.refIds, allocated.id, state);
  if (refIds.length === 0) {
    state.issues.push(warning('estimate.untraceable-driver', `${allocated.id} "${driver.label}" does not reference any reviewed scope item or deliverable element; review it as a possible unsupported addition.`, [allocated.id]));
  }
  return { ...driver, id: allocated.id, rationale: rationale.text, refIds };
}

function validateWorkstream(workstream: WorkstreamSuggestion, state: ValidationState): WorkstreamSuggestion {
  const allocated = state.workstreamId(workstream.id);
  if (allocated.replaced) {
    state.issues.push(warning('estimate.duplicate-id', `Workstream id ${workstream.id} was already used; "${workstream.name}" was renumbered to ${allocated.id}.`, [allocated.id]));
  }
  const firstType = workstream.drivers.at(0)?.type ?? 'capability';
  const phaseId = isBuildPhase(workstream.phaseId) ? workstream.phaseId : phaseForDriverType(firstType);
  if (phaseId !== workstream.phaseId) {
    state.issues.push(warning('estimate.invalid-phase', `${allocated.id} was assigned to ${workstream.phaseId}, which is not a build phase; it was moved to ${phaseId} based on its ${firstType} drivers.`, [allocated.id]));
  }
  return {
    ...workstream,
    id: allocated.id,
    phaseId,
    requirementIds: keepKnown(workstream.requirementIds, allocated.id, state),
    drivers: workstream.drivers.map((driver) => validateDriver(driver, state)),
  };
}

function validateNotes(notes: readonly EstimateNote[], prefix: string, state: ValidationState): EstimateNote[] {
  const allocate = createIdAllocator(prefix, notes.map((note) => note.id));
  return notes.map((note) => {
    const { id } = allocate(note.id);
    return { ...note, id, refs: keepKnown(note.refs, id, state) };
  });
}

export function validateSuggestion(raw: EstimateSuggestion, context: EstimateContext): SuggestionValidation {
  const state: ValidationState = {
    known: knownReferenceIds(context),
    issues: [],
    driverId: createIdAllocator('DRV', raw.workstreams.flatMap((workstream) => workstream.drivers.map((driver) => driver.id))),
    workstreamId: createIdAllocator('WS', raw.workstreams.map((workstream) => workstream.id)),
  };
  const workstreams = raw.workstreams.map((workstream) => validateWorkstream(workstream, state));
  const explanation = stripFigures(raw.explanation, '');
  if (explanation.changed) {
    state.issues.push(warning('estimate.figure-removed', 'The AI explanation stated effort, timeline or cost figures; those sentences were removed because numbers come only from the calculation engine.', []));
  }
  return {
    suggestion: {
      workstreams,
      risks: validateNotes(raw.risks, 'ER', state),
      dependencies: validateNotes(raw.dependencies, 'ED', state),
      assumptions: validateNotes(raw.assumptions, 'EA', state),
      exclusions: validateNotes(raw.exclusions, 'EX', state),
      explanation: explanation.text,
    },
    issues: state.issues,
  };
}
