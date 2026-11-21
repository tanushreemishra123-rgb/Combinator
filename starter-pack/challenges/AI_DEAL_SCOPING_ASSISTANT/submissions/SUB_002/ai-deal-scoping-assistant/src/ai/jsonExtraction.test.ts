import { extractJson } from './jsonExtraction';
import { AiProviderError } from './types';

describe('extractJson', () => {
  it('parses a plain JSON object', () => {
    expect(extractJson('{"a":1,"b":"two"}')).toEqual({ a: 1, b: 'two' });
  });

  it('parses a plain JSON array', () => {
    expect(extractJson('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('strips a ```json code fence around the object', () => {
    const text = '```json\n{"ok":true}\n```';
    expect(extractJson(text)).toEqual({ ok: true });
  });

  it('strips a plain ``` code fence with no language tag', () => {
    const text = '```\n{"ok":true}\n```';
    expect(extractJson(text)).toEqual({ ok: true });
  });

  it('ignores prose before and after the JSON', () => {
    const text = 'Here is the analysis you requested:\n{"summary":"ok"}\nLet me know if you need changes.';
    expect(extractJson(text)).toEqual({ summary: 'ok' });
  });

  it('does not get confused by braces inside string values', () => {
    const text = '{"note":"use {curly} braces carefully","count":2}';
    expect(extractJson(text)).toEqual({ note: 'use {curly} braces carefully', count: 2 });
  });

  it('does not get confused by an escaped quote inside a string value', () => {
    const text = String.raw`{"note":"she said \"hello\""}`;
    expect(extractJson(text)).toEqual({ note: 'she said "hello"' });
  });

  it('handles nested objects and arrays', () => {
    const text = '{"items":[{"id":"FR_01"},{"id":"FR_02"}],"meta":{"count":2}}';
    expect(extractJson(text)).toEqual({ items: [{ id: 'FR_01' }, { id: 'FR_02' }], meta: { count: 2 } });
  });

  it('throws AiProviderError(invalid-response) when there is no JSON at all', () => {
    expect(() => extractJson('Sorry, I cannot help with that.')).toThrow(AiProviderError);
    try {
      extractJson('no json here');
    } catch (error) {
      expect(error).toBeInstanceOf(AiProviderError);
      expect((error as AiProviderError).kind).toBe('invalid-response');
    }
  });

  it('throws AiProviderError(invalid-response) for an unbalanced object', () => {
    expect(() => extractJson('{"a": 1, "b": [1, 2')).toThrow(AiProviderError);
  });

  it('throws AiProviderError(invalid-response) for malformed JSON that still balances', () => {
    expect(() => extractJson("{'a': 1}")).toThrow(AiProviderError);
  });
});
