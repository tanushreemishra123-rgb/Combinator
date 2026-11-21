/**
 * AI orchestration layer: the provider contract (`types.ts`), the prompt kit, the orchestrator
 * (prompt -> provider -> JSON extraction -> Zod validation -> `GenerationMeta`), the mock and live
 * providers, and session-scoped AI mode settings.
 */
export * from './types';
export * from './promptKit';
export * from './jsonExtraction';
export * from './orchestrator';
export * from './settings';
export * from './providers/mockProvider';
export * from './providers/liveProvider';
