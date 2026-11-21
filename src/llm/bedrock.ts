/**
 * Amazon Bedrock adapter. Enabled purely by configuration
 * (COMBINATOR_LLM_PROVIDER=bedrock + AWS_REGION + BEDROCK_MODEL_ID); this file is
 * the only Bedrock-specific code, satisfying "usable through configuration or
 * only a small isolated adapter change". Credentials come from the standard AWS
 * provider chain — never hard-coded, never logged.
 *
 * Uses the Converse API so the same message shape works across Bedrock models.
 */
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
} from "@aws-sdk/client-bedrock-runtime";
import type { CombinatorConfig } from "../config.js";
import { estimateTokens, type LlmAdapter, type LlmRequest, type LlmResponse } from "./adapter.js";
import { groundingToText } from "../util.js";

export class BedrockAdapter implements LlmAdapter {
  readonly name = "bedrock";
  readonly model: string;
  private client: BedrockRuntimeClient;
  private cfg: CombinatorConfig;

  constructor(cfg: CombinatorConfig) {
    this.cfg = cfg;
    this.model = cfg.bedrock.modelId;
    this.client = new BedrockRuntimeClient({
      region: cfg.bedrock.region ?? process.env.AWS_REGION ?? "us-east-1",
    });
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const grounded = req.grounding
      ? `${req.user}\n\nGrounding (stay strictly faithful; do not add facts):\n${groundingToText(
          req.grounding,
        )}`
      : req.user;
    const messages: Message[] = [{ role: "user", content: [{ text: grounded }] }];
    let retries = 0;
    let lastErr: unknown;
    while (retries <= this.cfg.maxRetries) {
      try {
        const r = await this.client.send(
          new ConverseCommand({
            modelId: this.model,
            system: [{ text: req.system }],
            messages,
            inferenceConfig: {
              temperature: this.cfg.temperature,
              maxTokens: this.cfg.maxTokens,
            },
          }),
        );
        const text =
          r.output?.message?.content?.map((c) => ("text" in c ? c.text : "")).join("") ?? "";
        return {
          text,
          inputTokens: r.usage?.inputTokens ?? estimateTokens(req.system + grounded),
          outputTokens: r.usage?.outputTokens ?? estimateTokens(text),
          retries,
        };
      } catch (e) {
        lastErr = e;
        retries += 1;
        if (retries > this.cfg.maxRetries) break;
        await new Promise((res) => setTimeout(res, 500 * 2 ** (retries - 1)));
      }
    }
    throw new Error(`Bedrock request failed after ${retries} attempt(s): ${(lastErr as Error)?.message}`);
  }
}
