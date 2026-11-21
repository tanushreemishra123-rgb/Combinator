/** Builders shared by the analysis unit tests (kept free of any other module's runtime behaviour). */
import type { AnalyzeContext } from '../ai/types';
import type { CustomerContext, NormalizedDocument, ScopeItemDraft, SourceLine, SourceRef, SourceSection } from '../domain';

const HEADING = /^#{1,6}\s+(.*)$/;

/** Minimal normaliser for tests: markdown headings open sections, every line is numbered from 1. */
export function documentFromLines(texts: readonly string[]): NormalizedDocument {
  const sections: SourceSection[] = [{ id: 'S0', title: 'Requirements', level: 1, lineStart: 1, lineEnd: Math.max(texts.length, 1) }];
  const lines: SourceLine[] = texts.map((text, index) => {
    const heading = HEADING.exec(text);
    if (heading !== null) {
      sections.push({ id: `S${sections.length}`, title: heading.at(1) ?? '', level: 2, lineStart: index + 1, lineEnd: texts.length });
    }
    return { number: index + 1, text, sectionId: sections.at(-1)?.id ?? 'S0' };
  });
  const text = texts.join('\n');
  return { text, lines, sections, wordCount: text.split(/\s+/).filter((word) => word !== '').length };
}

export function blankCustomer(overrides: Partial<CustomerContext> = {}): CustomerContext {
  return { customerName: '', industry: '', opportunityName: '', region: '', engagementType: '', notes: '', ...overrides };
}

export function analyzeContextFor(texts: readonly string[], customer: CustomerContext = blankCustomer()): AnalyzeContext {
  return { task: 'analyze-requirements', document: documentFromLines(texts), customer, scenarioId: null };
}

export function draft(overrides: Partial<ScopeItemDraft> & Pick<ScopeItemDraft, 'id' | 'kind'>): ScopeItemDraft {
  return {
    title: `Item ${overrides.id}`,
    description: `Description of ${overrides.id}.`,
    priority: 'Medium',
    provenance: 'customer-stated',
    source: null,
    relatedIds: [],
    affectsInputs: [],
    critical: false,
    ...overrides,
  };
}

/** Unverified source reference carrying only a quote, as a model would return it. */
export function quoted(quote: string): SourceRef {
  return { sectionId: '', sectionTitle: '', lineStart: 0, lineEnd: 0, quote, verified: false };
}
