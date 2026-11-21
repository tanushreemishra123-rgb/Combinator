import { AnalysisOutputSchema, isValidIdForKind } from '../../domain';
import type { ScopeItemDraft } from '../../domain';
import { SCENARIOS } from '../scenarios';
import { getRecordedAnalysis } from '.';

/** Generous ceiling: a recording must never drop a customer statement to stay under a limit. */
const MAX_RECORDED_ITEMS = 80;

/** A numbered customer statement such as 'FR7. ...', 'NFR4. ...' or 'CON2. ...'. */
const NUMBERED_STATEMENT = /^[A-Z]{2,5}\d{1,2}\. /;

/** True when `quote` appears verbatim within at least one line of `text`. */
function isSubstringOfSomeLine(quote: string, text: string): boolean {
  return text.split('\n').some((line) => line.includes(quote));
}

describe('recorded mock-AI responses', () => {
  it('validates every recording against AnalysisOutputSchema and returns it for the unmodified seed text', () => {
    for (const scenario of SCENARIOS) {
      const recording = getRecordedAnalysis(scenario.id, scenario.requirementsText);
      expect(recording).toBeDefined();
      expect(() => AnalysisOutputSchema.parse(recording)).not.toThrow();
      expect(recording?.items.length).toBeGreaterThanOrEqual(35);
      expect(recording?.items.length).toBeLessThanOrEqual(MAX_RECORDED_ITEMS);
    }
  });

  it('captures every numbered customer statement of the source text, so nothing the customer wrote is silently dropped', () => {
    for (const scenario of SCENARIOS) {
      const recording = getRecordedAnalysis(scenario.id, scenario.requirementsText);
      const quotes = (recording?.items ?? []).map((item) => item.source?.quote ?? '');
      const statements = scenario.requirementsText.split('\n').map((line) => line.trim()).filter((line) => NUMBERED_STATEMENT.test(line));
      const dropped = statements.filter((statement) => !quotes.some((quote) => quote !== '' && statement.includes(quote)));
      expect(dropped, scenario.id).toEqual([]);
    }
  });

  it('returns undefined once the requirements text has been edited', () => {
    const scenario = SCENARIOS.at(0);
    expect(scenario).toBeDefined();
    if (scenario === undefined) return;
    const edited = `${scenario.requirementsText}\nOne extra line the customer never sent.`;
    expect(getRecordedAnalysis(scenario.id, edited)).toBeUndefined();
  });

  it('returns undefined for an unknown scenario id', () => {
    const scenario = SCENARIOS.at(0);
    expect(scenario).toBeDefined();
    if (scenario === undefined) return;
    expect(getRecordedAnalysis('not-a-real-scenario', scenario.requirementsText)).toBeUndefined();
  });

  it('gives every customer-stated item a verbatim quote that is a substring of a single source line', () => {
    for (const scenario of SCENARIOS) {
      const recording = getRecordedAnalysis(scenario.id, scenario.requirementsText);
      expect(recording).toBeDefined();
      if (recording === undefined) continue;
      const customerStated = recording.items.filter((item) => item.provenance === 'customer-stated');
      expect(customerStated.length).toBeGreaterThan(0);
      for (const item of customerStated) {
        expect(item.source).not.toBeNull();
        const quote = item.source?.quote ?? '';
        expect(quote.length).toBeGreaterThan(0);
        expect(isSubstringOfSomeLine(quote, scenario.requirementsText)).toBe(true);
      }
    }
  });

  it('gives every item a unique, well-formed structured id for its kind', () => {
    for (const scenario of SCENARIOS) {
      const recording = getRecordedAnalysis(scenario.id, scenario.requirementsText);
      expect(recording).toBeDefined();
      if (recording === undefined) continue;
      const ids = recording.items.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const item of recording.items) {
        expect(isValidIdForKind(item.id, item.kind)).toBe(true);
      }
    }
  });

  it('resolves every relatedId to another item in the same recording', () => {
    for (const scenario of SCENARIOS) {
      const recording = getRecordedAnalysis(scenario.id, scenario.requirementsText);
      expect(recording).toBeDefined();
      if (recording === undefined) continue;
      const knownIds = new Set(recording.items.map((item) => item.id));
      for (const item of recording.items) {
        for (const relatedId of item.relatedIds) {
          expect(knownIds.has(relatedId)).toBe(true);
        }
      }
    }
  });

  it('sets source sectionId/sectionTitle/line numbers to empty and verified to false for the grounding validator to fill in', () => {
    for (const scenario of SCENARIOS) {
      const recording = getRecordedAnalysis(scenario.id, scenario.requirementsText);
      expect(recording).toBeDefined();
      if (recording === undefined) continue;
      for (const item of recording.items) {
        if (item.source === null) continue;
        expect(item.source.sectionId).toBe('');
        expect(item.source.sectionTitle).toBe('');
        expect(item.source.lineStart).toBe(0);
        expect(item.source.lineEnd).toBe(0);
        expect(item.source.verified).toBe(false);
      }
    }
  });

  it('covers every ScopeItemKind that genuinely applies to each scenario', () => {
    const appMod = getRecordedAnalysis('app-modernization-claims-portal', SCENARIOS.find((s) => s.id === 'app-modernization-claims-portal')?.requirementsText ?? '');
    expect(appMod).toBeDefined();
    const kinds = new Set((appMod?.items ?? []).map((item: ScopeItemDraft) => item.kind));
    expect(kinds.size).toBe(15);
  });

  it('gives the missing-information scenario at least eight gap or question items', () => {
    const scenario = SCENARIOS.find((s) => s.category === 'missing-information');
    expect(scenario).toBeDefined();
    if (scenario === undefined) return;
    const recording = getRecordedAnalysis(scenario.id, scenario.requirementsText);
    expect(recording).toBeDefined();
    const gapOrQuestion = (recording?.items ?? []).filter((item) => item.kind === 'gap' || item.kind === 'question');
    expect(gapOrQuestion.length).toBeGreaterThanOrEqual(8);
  });

  it('never emits filler placeholder text in any recorded item', () => {
    for (const scenario of SCENARIOS) {
      const recording = getRecordedAnalysis(scenario.id, scenario.requirementsText);
      expect(recording).toBeDefined();
      if (recording === undefined) continue;
      const text = [recording.summary, ...recording.items.flatMap((item) => [item.title, item.description])].join(' ').toLowerCase();
      for (const forbidden of ['lorem', 'acme', 'tbd-placeholder', 'undefined', 'null', '[object object]']) {
        expect(text.includes(forbidden)).toBe(false);
      }
    }
  });
});
