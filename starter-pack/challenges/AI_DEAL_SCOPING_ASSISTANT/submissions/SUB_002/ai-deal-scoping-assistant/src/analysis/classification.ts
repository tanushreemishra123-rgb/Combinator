/**
 * Stage 2 of the heuristic engine: statement -> scope item kind.
 *
 * Precedence (first match wins):
 *   1. uncertainty wording or a question mark      -> gap (+ clarification question)
 *   2. the customer's own requirement label ("NFR3.", "INT-02:") -> the kind that label names
 *   3. preference wording naming a technology      -> technology
 *   4. assumption / risk / dependency cues, then a section headed as such
 *   5. actor-capability phrasing ("must be able to") -> functional, or integration when it syncs
 *   6. constraint and integration cues
 *   7. a descriptive statement (no obligation wording) in a current-landscape section -> existingSystem
 *   8. existing system, security, non-functional, business, data cues
 *   9. the heading of the enclosing section
 *  10. bare obligation wording ("must", "we need")  -> functional
 * Statements matching nothing, and document metadata lines, are context, not scope, and yield no item.
 */
import type { ScopeItemKind } from '../domain';
import {
  INTEGRATION_CUES,
  KIND_CUES,
  METADATA_PREFIXES,
  OBLIGATION_CUES,
  REQUIREMENT_LABEL_KINDS,
  SECTION_HINTS,
  TECHNOLOGY_NAMES,
  TECHNOLOGY_PREFERENCE_CUES,
  UNCERTAINTY_CUES,
  USER_CAPABILITY_CUES,
} from './classificationCues.data';
import type { KindCueEntry } from './classificationCues.data';
import type { Statement } from './segmentation';
import { containsAnyTerm, findFirstTerm, normalizeForMatch } from './textMatch';

export interface Classification {
  kind: ScopeItemKind;
  /** The cue that decided the kind - shown to reviewers as the classification rationale. */
  cue: string;
  /** True when the customer literally asked a question. */
  isQuestion: boolean;
}

/** Kinds whose cues outrank actor-capability phrasing ("we assume users can ..." is an assumption). */
const META_KINDS: ReadonlySet<ScopeItemKind> = new Set<ScopeItemKind>(['assumption', 'risk', 'dependency']);
const QUESTION_MARKS: readonly string[] = ['?', '？'];

function isQuestionText(text: string): boolean {
  return QUESTION_MARKS.some((mark) => text.trimEnd().endsWith(mark));
}

function matchCueTable(normalized: string, table: readonly KindCueEntry[]): Classification | null {
  for (const entry of table) {
    const cue = findFirstTerm(normalized, entry.terms);
    if (cue !== undefined) {
      return { kind: entry.kind, cue, isQuestion: false };
    }
  }
  return null;
}

function classifyUncertainty(statement: Statement): Classification | null {
  if (isQuestionText(statement.text)) {
    return { kind: 'gap', cue: 'question mark', isQuestion: true };
  }
  const cue = findFirstTerm(statement.normalized, UNCERTAINTY_CUES);
  return cue === undefined ? null : { kind: 'gap', cue, isQuestion: false };
}

/** A labelled requirement keeps the classification the customer gave it. */
function classifyByLabel(statement: Statement): Classification | null {
  const kind = REQUIREMENT_LABEL_KINDS.get(statement.label);
  return kind === undefined ? null : { kind, cue: `customer label ${statement.label}`, isQuestion: false };
}

function classifyTechnology(normalized: string): Classification | null {
  const preference = findFirstTerm(normalized, TECHNOLOGY_PREFERENCE_CUES);
  const technology = findFirstTerm(normalized, TECHNOLOGY_NAMES);
  if (preference === undefined || technology === undefined) {
    return null;
  }
  return { kind: 'technology', cue: `${preference} + ${technology}`, isQuestion: false };
}

function classifyCapability(normalized: string): Classification | null {
  const cue = findFirstTerm(normalized, USER_CAPABILITY_CUES);
  if (cue === undefined) {
    return null;
  }
  const kind: ScopeItemKind = containsAnyTerm(normalized, INTEGRATION_CUES) ? 'integration' : 'functional';
  return { kind, cue, isQuestion: false };
}

function classifyObligation(normalized: string): Classification | null {
  const cue = findFirstTerm(normalized, OBLIGATION_CUES);
  return cue === undefined ? null : { kind: 'functional', cue, isQuestion: false };
}

/** Delivery and interface cues stay decisive even inside a section that describes the landscape. */
const LEADING_KINDS: ReadonlySet<ScopeItemKind> = new Set<ScopeItemKind>(['constraint', 'integration']);

const META_CUES = KIND_CUES.filter((entry) => META_KINDS.has(entry.kind));
const LEADING_CUES = KIND_CUES.filter((entry) => LEADING_KINDS.has(entry.kind));
const CONTENT_CUES = KIND_CUES.filter((entry) => !META_KINDS.has(entry.kind) && !LEADING_KINDS.has(entry.kind));
const META_SECTION_HINTS = SECTION_HINTS.filter((entry) => META_KINDS.has(entry.kind));
const LANDSCAPE_SECTION_HINTS = SECTION_HINTS.filter((entry) => entry.kind === 'existingSystem');

/** "Okta is our corporate identity provider" under "Current systems" describes a system, not a control. */
function classifyLandscapeDescription(normalized: string, section: string): Classification | null {
  return containsAnyTerm(normalized, OBLIGATION_CUES) ? null : matchCueTable(section, LANDSCAPE_SECTION_HINTS);
}

/** Classifies one statement, or returns null when it is background context rather than scope. */
export function classifyStatement(statement: Statement): Classification | null {
  const normalized = statement.normalized;
  if (METADATA_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return null;
  }
  const section = normalizeForMatch(statement.sectionTitle);
  return (
    classifyUncertainty(statement) ??
    classifyByLabel(statement) ??
    classifyTechnology(normalized) ??
    matchCueTable(normalized, META_CUES) ??
    matchCueTable(section, META_SECTION_HINTS) ??
    classifyCapability(normalized) ??
    matchCueTable(normalized, LEADING_CUES) ??
    classifyLandscapeDescription(normalized, section) ??
    matchCueTable(normalized, CONTENT_CUES) ??
    matchCueTable(section, SECTION_HINTS) ??
    classifyObligation(normalized)
  );
}
