import { z } from 'zod';
import aiStrategyOutputSchemaJson from './aiStrategyOutput.schema.json';
import analysisOutputSchemaJson from './analysisOutput.schema.json';
import architectureOutputSchemaJson from './architectureOutput.schema.json';
import dataIntegrationOutputSchemaJson from './dataIntegrationOutput.schema.json';
import { EXPECTED_SCHEMAS, SCHEMA_FILE_NAMES } from './expectedSchemas';
import estimateSuggestionSchemaJson from './estimateSuggestion.schema.json';
import prdOutputSchemaJson from './prdOutput.schema.json';

const COMMITTED_ENTRIES: readonly (readonly [string, unknown])[] = [
  ['analysisOutput', analysisOutputSchemaJson],
  ['prdOutput', prdOutputSchemaJson],
  ['architectureOutput', architectureOutputSchemaJson],
  ['dataIntegrationOutput', dataIntegrationOutputSchemaJson],
  ['aiStrategyOutput', aiStrategyOutputSchemaJson],
  ['estimateSuggestion', estimateSuggestionSchemaJson],
];

/** Committed file name -> its parsed JSON content, so the sync check never uses a dynamic import path. */
const COMMITTED_JSON: ReadonlyMap<string, unknown> = new Map(COMMITTED_ENTRIES);

describe('expected structured-output schemas', () => {
  it('covers every AI task the seed module knows about', () => {
    expect(EXPECTED_SCHEMAS.size).toBe(6);
    expect(SCHEMA_FILE_NAMES.size).toBe(6);
  });

  it('keeps every committed *.schema.json file byte-identical to z.toJSONSchema(schema)', () => {
    for (const [name, schema] of EXPECTED_SCHEMAS) {
      const fileName = SCHEMA_FILE_NAMES.get(name);
      expect(fileName).toBeDefined();
      if (fileName === undefined) continue;
      const committed = COMMITTED_JSON.get(fileName);
      expect(committed).toBeDefined();
      expect(committed).toStrictEqual(z.toJSONSchema(schema));
    }
  });
});
