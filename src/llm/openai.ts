/**
 * OpenAI adapter (default live provider). Credentials and model come from config.
 * Retries with exponential backoff up to cfg.maxRetries. No key is ever logged.
 */
import OpenAI from "openai";
import type { CombinatorConfig } from "../config.js";
import { estimateTokens, type LlmAdapter, type LlmRequest, type LlmResponse } from "./adapter.js";
import { groundingToText } from "../util.js";

export class OpenAiAdapter implements LlmAdapter {
  readonly name = "openai";
  readonly model: string;
  private client: OpenAI;
  private cfg: CombinatorConfig;

  constructor(cfg: CombinatorConfig) {
    if (!cfg.openai.apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Use COMBINATOR_LLM_PROVIDER=mock for keyless review, or set the key.",
      );
    }
    this.cfg = cfg;
    this.model = cfg.openai.model;
    this.client = new OpenAI({
      apiKey: cfg.openai.apiKey,
      baseURL: cfg.openai.baseUrl,
      timeout: cfg.timeoutMs,
      maxRetries: 0, // we manage retries so we can count them
    });
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    let retries = 0;
    let lastErr: unknown;
    const grounded = req.grounding
      ? `${req.user}\n\nGrounding (stay strictly faithful; do not add facts):\n${groundingToText(
          req.grounding,
        )}`
      : req.user;
    while (retries <= this.cfg.maxRetries) {
      try {
        const r = await this.client.chat.completions.create({
          model: this.model,
          temperature: this.cfg.temperature,
          max_tokens: this.cfg.maxTokens,
          // Stable per-tool end-user identifier (abuse-monitoring best practice);
          // carries no personal data.
          user: "tc-combinator",
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: grounded },
          ],
        });
        const text = r.choices[0]?.message?.content ?? "";
        return {
          text,
          inputTokens: r.usage?.prompt_tokens ?? estimateTokens(req.system + grounded),
          outputTokens: r.usage?.completion_tokens ?? estimateTokens(text),
          retries,
        };
      } catch (e) {
        lastErr = e;
        retries += 1;
        if (retries > this.cfg.maxRetries) break;
        await new Promise((res) => setTimeout(res, 500 * 2 ** (retries - 1)));
      }
    }
    throw new Error(`OpenAI request failed after ${retries} attempt(s): ${(lastErr as Error)?.message}`);
  }
}
