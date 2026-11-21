/**
 * Changes to reviewed scope items, matched by id: priority, wording, scope inclusion/exclusion
 * (including added and removed items) and the resolution of questions, gaps and assumptions.
 */
import { kindLabel } from '../../scope';
import type { ChangeDescriptor, ChangeKind, ScopeItem, ScopeModel } from '../../domain';
import { quote } from '../format';

const NOT_IN_MODEL = 'Not in the scope model';
const REMOVED_FROM_MODEL = 'Removed from the scope model';

/** Inclusion state as the reviewer sees it; pending and approved items are both 'In scope'. */
function inclusionState(item: ScopeItem): string {
  if (item.review === 'rejected') {
    return 'Rejected';
  }
  return item.inScope ? 'In scope' : 'Out of scope';
}

function describeItem(item: ScopeItem): string {
  return `${kindLabel(item.kind)} ${item.id} ${quote(item.title)}`;
}

/** Security wording and assumption wording have their own change kinds in the spec's list. */
function textChangeKind(item: ScopeItem): ChangeKind {
  if (item.kind === 'security') {
    return 'security-requirement';
  }
  return item.kind === 'assumption' ? 'assumption' : 'requirement-text';
}

function priorityChange(before: ScopeItem, after: ScopeItem): ChangeDescriptor[] {
  if (before.priority === after.priority) {
    return [];
  }
  const label = `Priority of ${describeItem(after)} changed from ${before.priority} to ${after.priority}`;
  return [{ kind: 'requirement-priority', targetId: after.id, label, from: before.priority, to: after.priority }];
}

function textChange(before: ScopeItem, after: ScopeItem): ChangeDescriptor[] {
  if (before.title === after.title && before.description === after.description) {
    return [];
  }
  const from = `${before.title}: ${before.description}`;
  const to = `${after.title}: ${after.description}`;
  const label = `${kindLabel(after.kind)} ${after.id} was reworded from ${quote(before.title)} to ${quote(after.title)}`;
  const sameTitleLabel = `${kindLabel(after.kind)} ${after.id} ${quote(after.title)} was reworded to ${quote(after.description)}`;
  return [{ kind: textChangeKind(after), targetId: after.id, label: before.title === after.title ? sameTitleLabel : label, from, to }];
}

function inclusionChange(before: ScopeItem, after: ScopeItem): ChangeDescriptor[] {
  const from = inclusionState(before);
  const to = inclusionState(after);
  if (from === to) {
    return [];
  }
  return [{ kind: 'scope-inclusion', targetId: after.id, label: `Scope inclusion of ${describeItem(after)} changed from ${from} to ${to}`, from, to }];
}

interface ResolutionVocabulary {
  kind: ChangeKind;
  open: string;
  resolved: string;
}

/** Only questions, gaps and assumptions carry a meaningful `resolved` flag. */
function resolutionVocabulary(item: ScopeItem): ResolutionVocabulary | null {
  switch (item.kind) {
    case 'question':
      return { kind: 'question-resolved', open: 'Open', resolved: 'Answered' };
    case 'gap':
      return { kind: 'question-resolved', open: 'Open', resolved: 'Closed' };
    case 'assumption':
      return { kind: 'assumption', open: 'Unvalidated', resolved: 'Validated' };
    default:
      return null;
  }
}

function resolutionChange(before: ScopeItem, after: ScopeItem): ChangeDescriptor[] {
  const vocabulary = resolutionVocabulary(after);
  if (vocabulary === null || before.resolved === after.resolved) {
    return [];
  }
  const from = before.resolved ? vocabulary.resolved : vocabulary.open;
  const to = after.resolved ? vocabulary.resolved : vocabulary.open;
  const note = after.resolved && after.resolution.trim() !== '' ? `: ${quote(after.resolution)}` : '';
  return [{ kind: vocabulary.kind, targetId: after.id, label: `${describeItem(after)} changed from ${from} to ${to}${note}`, from, to }];
}

function addedItem(item: ScopeItem): ChangeDescriptor {
  const to = inclusionState(item);
  return { kind: 'scope-inclusion', targetId: item.id, label: `${describeItem(item)} was added to the scope model (${to})`, from: NOT_IN_MODEL, to };
}

function removedItem(item: ScopeItem): ChangeDescriptor {
  return { kind: 'scope-inclusion', targetId: item.id, label: `${describeItem(item)} was removed from the scope model`, from: inclusionState(item), to: REMOVED_FROM_MODEL };
}

function itemChanges(before: ScopeItem, after: ScopeItem): ChangeDescriptor[] {
  return [...priorityChange(before, after), ...textChange(before, after), ...inclusionChange(before, after), ...resolutionChange(before, after)];
}

/** No scope changes are reported while either snapshot has no scope model (first analysis is not an edit). */
export function describeScopeChanges(before: ScopeModel | null, after: ScopeModel | null): ChangeDescriptor[] {
  if (before === null || after === null) {
    return [];
  }
  const previous = new Map(before.items.map((item) => [item.id, item]));
  const currentIds = new Set(after.items.map((item) => item.id));
  const editedOrAdded = after.items.flatMap((item) => {
    const earlier = previous.get(item.id);
    return earlier === undefined ? [addedItem(item)] : itemChanges(earlier, item);
  });
  const removed = before.items.filter((item) => !currentIds.has(item.id)).map(removedItem);
  return [...editedOrAdded, ...removed];
}
