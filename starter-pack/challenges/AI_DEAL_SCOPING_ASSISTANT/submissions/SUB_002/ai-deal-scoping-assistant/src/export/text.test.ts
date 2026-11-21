import {
  contentLabelText,
  daysRangeText,
  formatTimestamp,
  joinOrFallback,
  joinSentences,
  moneyRangeOrBlocked,
  moneyRangeText,
  notGeneratedCallout,
  paragraphsFromText,
  platformDisplayName,
  provenanceBlock,
  refsCell,
  slugify,
  sourceReferenceText,
  statementLine,
  tableOrParagraph,
  weeksRangeText,
} from './text';

describe('formatTimestamp', () => {
  it('renders an ISO timestamp as a locale-independent UTC date and time', () => {
    expect(formatTimestamp('2026-09-19T08:30:12.345Z')).toBe('2026-09-19 08:30 UTC');
  });

  it('leaves anything that is not an ISO timestamp untouched', () => {
    expect(formatTimestamp('yesterday')).toBe('yesterday');
    expect(formatTimestamp('2026-09-19T08:30:12+05:30')).toBe('2026-09-19T08:30:12+05:30');
  });
});

describe('platformDisplayName', () => {
  it('names every supported platform and states when none is selected', () => {
    expect(platformDisplayName('aws')).toContain('AWS');
    expect(platformDisplayName('azure')).toContain('Azure');
    expect(platformDisplayName('gcp')).toContain('GCP');
    expect(platformDisplayName(null)).toBe('Not yet selected');
  });
});

describe('contentLabelText', () => {
  it('marks a recommended enhancement as an AI recommendation', () => {
    expect(contentLabelText('recommended-enhancement')).toBe('AI recommendation');
  });

  it('gives every content label a non-empty, human-readable name', () => {
    const labels: Parameters<typeof contentLabelText>[0][] = ['customer-requested', 'ai-interpretation', 'recommended-enhancement', 'assumption-to-confirm', 'out-of-scope'];
    for (const label of labels) {
      expect(contentLabelText(label).length).toBeGreaterThan(0);
    }
  });
});

describe('joinOrFallback / refsCell', () => {
  it('falls back instead of rendering an empty string', () => {
    expect(joinOrFallback([], 'None')).toBe('None');
    expect(joinOrFallback(['FR_01', 'FR_02'], 'None')).toBe('FR_01, FR_02');
    expect(refsCell([])).toBe('None cited');
  });
});

describe('joinSentences', () => {
  it('falls back instead of rendering an empty string', () => {
    expect(joinSentences([], 'None noted')).toBe('None noted');
  });

  it('joins full sentences with a single space instead of splicing a comma after the period', () => {
    const text = joinSentences(['Edge caching improves latency but requires explicit cache-invalidation on release.', 'A globally distributed edge adds a small recurring data-transfer cost versus single-region hosting.'], 'None noted');
    expect(text).toBe('Edge caching improves latency but requires explicit cache-invalidation on release. A globally distributed edge adds a small recurring data-transfer cost versus single-region hosting.');
    expect(text).not.toContain('.,');
  });

  it('joins sentence fragments (no terminal punctuation) with "; " instead of a bare space', () => {
    expect(joinSentences(['SAP S/4HANA integration pattern unconfirmed (GAP_01) is still open', 'Policyholder status tracker phase undecided (GAP_02) is still open'], 'None noted')).toBe(
      'SAP S/4HANA integration pattern unconfirmed (GAP_01) is still open; Policyholder status tracker phase undecided (GAP_02) is still open',
    );
  });

  it('picks the separator per boundary when sentences and fragments are mixed', () => {
    expect(joinSentences(['First sentence.', 'second fragment', 'Third sentence!'], 'None noted')).toBe('First sentence. second fragment; Third sentence!');
  });
});

describe('sourceReferenceText', () => {
  it('formats a verified source as "Section - lines a-b"', () => {
    expect(sourceReferenceText({ sectionId: 'S1', sectionTitle: 'Business goals', lineStart: 2, lineEnd: 3, quote: 'text', verified: true })).toBe('Business goals - lines 2-3');
  });

  it('flags an unverified source and states when there is no source at all', () => {
    expect(sourceReferenceText({ sectionId: 'S1', sectionTitle: 'Business goals', lineStart: 2, lineEnd: 3, quote: 'text', verified: false })).toContain('not verified');
    expect(sourceReferenceText(null)).toBe('Not sourced from a specific customer passage');
    expect(sourceReferenceText({ sectionId: '', sectionTitle: '', lineStart: 0, lineEnd: 0, quote: '', verified: false })).toBe('Not sourced from a specific customer passage');
  });
});

describe('statementLine', () => {
  it('suffixes the statement text with its refs and content label', () => {
    const line = statementLine({ text: 'Members can sign in with SSO.', refs: ['FR_01'], label: 'customer-requested' });
    expect(line).toBe('Members can sign in with SSO. (Refs: FR_01; Customer-requested)');
  });
});

describe('money and numeric range formatting', () => {
  it('formats a money range with low/likely/high', () => {
    expect(moneyRangeText({ low: 1000, likely: 1500, high: 2000, currency: 'USD' })).toBe('1,000 USD to 2,000 USD (likely 1,500 USD)');
  });

  it('renders the blocked text instead of a range when the range is null', () => {
    expect(moneyRangeOrBlocked(null, 'Blocked - rates missing')).toBe('Blocked - rates missing');
    expect(moneyRangeOrBlocked({ low: 1, likely: 2, high: 3, currency: 'USD' }, 'Blocked')).not.toBe('Blocked');
  });

  it('formats day and week ranges', () => {
    expect(daysRangeText({ low: 10, likely: 12, high: 15 })).toBe('10 to 15 person-days (likely 12)');
    expect(weeksRangeText({ low: 1, likely: 2, high: 3 })).toBe('1 to 3 weeks (likely 2)');
  });
});

describe('notGeneratedCallout', () => {
  it('produces a warning callout with the standard prefix', () => {
    const block = notGeneratedCallout('the PRD has not been generated yet');
    expect(block).toEqual({ type: 'callout', tone: 'warning', title: 'Not generated yet', text: 'Not generated yet - the PRD has not been generated yet.' });
  });
});

describe('tableOrParagraph', () => {
  it('renders a table when there are rows, and a paragraph when there are none', () => {
    expect(tableOrParagraph(['A'], [['1']], 'empty')).toEqual({ type: 'table', columns: ['A'], rows: [['1']] });
    expect(tableOrParagraph(['A'], [], 'Nothing here.')).toEqual({ type: 'paragraph', text: 'Nothing here.' });
  });
});

describe('provenanceBlock', () => {
  it('returns null when there is no generation metadata', () => {
    expect(provenanceBlock(null)).toBeNull();
  });

  it('summarises provider, mode, fallback and time as key/value pairs', () => {
    const block = provenanceBlock({ providerId: 'mock', providerLabel: 'Mock AI', mode: 'mock', usedFallback: false, generatedAt: '2026-01-01T00:00:00.000Z', durationMs: 5, scopeVersion: 1, issues: [] });
    if (block?.type !== 'keyValues') {
      throw new Error('expected a keyValues block');
    }
    expect(block.pairs.map((pair) => pair.key)).toEqual(['Generated by', 'Mode', 'Fallback used', 'Generated at']);
  });
});

describe('paragraphsFromText', () => {
  it('splits on blank lines and drops empty parts', () => {
    expect(paragraphsFromText('First.\n\nSecond.\n\n\n')).toEqual([
      { type: 'paragraph', text: 'First.' },
      { type: 'paragraph', text: 'Second.' },
    ]);
  });
});

describe('slugify', () => {
  it('produces a lowercase, hyphenated anchor', () => {
    expect(slugify('Solution Architecture & Diagram')).toBe('solution-architecture-diagram');
  });
});
