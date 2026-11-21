/**
 * Expected structured-output schemas: the Zod schemas every AI task's output is validated against,
 * keyed by task name. The committed `*.schema.json` files in this folder are `z.toJSONSchema`
 * snapshots of the same schemas, generated for reviewers and integrators who want the JSON Schema
 * form without importing Zod; `expectedSchemas.test.ts` asserts the two can never drift apart.
 */
import type { z } from 'zod';
import {
  AiStrategyOutputSchema,
  AnalysisOutputSchema,
  ArchitectureOutputSchema,
  DataIntegrationOutputSchema,
  EstimateSuggestionSchema,
  PrdOutputSchema,
} from '../../domain';

export type ExpectedSchemaName =
  | 'analyze-requirements'
  | 'generate-prd'
  | 'design-architecture'
  | 'plan-data-integration'
  | 'plan-ai-solution'
  | 'suggest-estimate-inputs';

const SCHEMA_ENTRIES: readonly (readonly [ExpectedSchemaName, z.ZodType])[] = [
  ['analyze-requirements', AnalysisOutputSchema],
  ['generate-prd', PrdOutputSchema],
  ['design-architecture', ArchitectureOutputSchema],
  ['plan-data-integration', DataIntegrationOutputSchema],
  ['plan-ai-solution', AiStrategyOutputSchema],
  ['suggest-estimate-inputs', EstimateSuggestionSchema],
];

/** Task name -> the Zod schema its structured AI output must satisfy, and the committed JSON file it maps to. */
export const EXPECTED_SCHEMAS: ReadonlyMap<ExpectedSchemaName, z.ZodType> = new Map(SCHEMA_ENTRIES);

/** File name (without extension) each schema is committed under in this folder. */
export const SCHEMA_FILE_NAMES: ReadonlyMap<ExpectedSchemaName, string> = new Map([
  ['analyze-requirements', 'analysisOutput'],
  ['generate-prd', 'prdOutput'],
  ['design-architecture', 'architectureOutput'],
  ['plan-data-integration', 'dataIntegrationOutput'],
  ['plan-ai-solution', 'aiStrategyOutput'],
  ['suggest-estimate-inputs', 'estimateSuggestion'],
]);
