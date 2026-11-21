/**
 * Configuration loader. Everything the solution needs — provider selection,
 * model IDs, region, endpoints, timeouts, inference settings, cost model — comes
 * from environment/config, never hard-coded (challenge §Technical Requirements).
 *
 * A minimal, dependency-free .env parser is included so the tool runs without
 * pulling an extra package; real env vars always win over the file.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pick, put } from "./util.js";

export type ProviderName = "mock" | "openai" | "bedrock";

export interface CombinatorConfig {
  provider: ProviderName;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  maxRetries: number;
  openai: { apiKey?: string; model: string; baseUrl?: string };
  bedrock: { region?: string; modelId: string };
  cost: { per1kInput: number; per1kOutput: number };
  uiPort: number;
}

function loadDotEnv(cwd: string): void {
  const p = resolve(cwd, ".env");
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (pick(process.env, key) === undefined) put(process.env, key, val);
  }
}

function num(name: string, dflt: number): number {
  const v = pick<string>(process.env, name);
  if (v === undefined || v === "") return dflt;
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

export function loadConfig(cwd = process.cwd()): CombinatorConfig {
  loadDotEnv(cwd);
  const provider = (process.env.COMBINATOR_LLM_PROVIDER || "mock").toLowerCase() as ProviderName;
  return {
    provider: ["mock", "openai", "bedrock"].includes(provider) ? provider : "mock",
    temperature: num("COMBINATOR_LLM_TEMPERATURE", 0),
    maxTokens: num("COMBINATOR_LLM_MAX_TOKENS", 1200),
    timeoutMs: num("COMBINATOR_LLM_TIMEOUT_MS", 60000),
    maxRetries: num("COMBINATOR_LLM_MAX_RETRIES", 2),
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      baseUrl: process.env.OPENAI_BASE_URL,
    },
    bedrock: {
      region: process.env.AWS_REGION,
      modelId: process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-5-sonnet-20240620-v1:0",
    },
    cost: {
      per1kInput: num("COMBINATOR_COST_PER_1K_INPUT", 0.00015),
      per1kOutput: num("COMBINATOR_COST_PER_1K_OUTPUT", 0.0006),
    },
    uiPort: num("COMBINATOR_UI_PORT", 4600),
  };
}
