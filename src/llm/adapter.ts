/**
 * LLM provider adapter (challenge §Technical Requirements).
 *
 * One documented interface; provider-specific logic isolated behind it. Default
 * live provider is OpenAI; Amazon Bedrock is usable through configuration or a
 * small isolated adapter change (bedrock.ts). A deterministic mock supports
 * organizer review with no paid AI access and no network.
 *
 * Design note: the Combinator's *facts* (requirement coverage, base suitability,
 * contradictions, verification) are computed deterministically from real file
 * and document inspection. The LLM is a narration/enrichment layer only, so the
 * tool produces grounded output even in mock mode and never fabricates evidence.
 */
import type { CombinatorConfig } from "../config.js";
import type { UsageMeter } from "../logger.js";

export interface LlmRequest {
  /** Stable task id — used by the mock for deterministic routing. */
  task: string;
  system: string;
  user: string;
  /** Structured signals the narration must stay faithful to. */
  grounding?: Record<string, unknown>;
}

export interface LlmResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  retries: number;
}

export interface LlmAdapter {
  readonly name: string;
  readonly model: string;
  complete(req: LlmRequest): Promise<LlmResponse>;
}

/** Rough token estimate when a provider does not report usage. */
export function estimateTokens(s: string): number {
  return Math.max(1, Math.ceil(s.length / 4));
}

export async function createAdapter(
  cfg: CombinatorConfig,
  meter: UsageMeter,
): Promise<LlmAdapter> {
  let adapter: LlmAdapter;
  switch (cfg.provider) {
    case "openai": {
      const { OpenAiAdapter } = await import("./openai.js");
      adapter = new OpenAiAdapter(cfg);
      break;
    }
    case "bedrock": {
      const { BedrockAdapter } = await import("./bedrock.js");
      adapter = new BedrockAdapter(cfg);
      break;
    }
    default: {
      const { MockAdapter } = await import("./mock.js");
      adapter = new MockAdapter();
    }
  }
  meter.setProvider(adapter.name, adapter.model);
  // Wrap with usage metering so every provider reports uniformly.
  return {
    name: adapter.name,
    model: adapter.model,
    async complete(req) {
      try {
        const res = await adapter.complete(req);
        meter.record(res.inputTokens, res.outputTokens, res.retries);
        return res;
      } catch (e) {
        meter.recordFailure();
        throw e;
      }
    },
  };
}
