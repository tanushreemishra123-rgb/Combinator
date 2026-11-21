/**
 * Structured logger + audit trail + usage accumulator.
 *
 * - Audit: every file-modifying operation is appended to an in-memory audit log
 *   that the orchestrator writes to the workspace (spec: "Audit every
 *   file-modifying operation").
 * - Usage: LLM adapters report tokens/calls/retries/failures here so the final
 *   usage report is accurate regardless of provider.
 * - Secrets are never logged; the logger has no access to raw credentials.
 */
import type { UsageReport } from "./types.js";

export interface AuditEvent {
  at: string;
  op: "write" | "copy" | "delete" | "mkdir" | "rollback" | "exec";
  target: string;
  detail?: string;
}

export class Logger {
  private audit: AuditEvent[] = [];
  private verbose: boolean;
  constructor(verbose = true) {
    this.verbose = verbose;
  }
  info(msg: string): void {
    if (this.verbose) process.stderr.write(`[combinator] ${msg}\n`);
  }
  warn(msg: string): void {
    process.stderr.write(`[combinator:warn] ${msg}\n`);
  }
  recordAudit(ev: Omit<AuditEvent, "at">): void {
    this.audit.push({ at: new Date().toISOString(), ...ev });
  }
  getAudit(): AuditEvent[] {
    return this.audit.slice();
  }
}

export class UsageMeter {
  private provider = "mock";
  private model = "mock";
  private calls = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private retries = 0;
  private failures = 0;
  private per1kInput: number;
  private per1kOutput: number;
  private startedAt = Date.now();

  constructor(per1kInput: number, per1kOutput: number) {
    this.per1kInput = per1kInput;
    this.per1kOutput = per1kOutput;
  }
  setProvider(provider: string, model: string): void {
    this.provider = provider;
    this.model = model;
  }
  record(input: number, output: number, retries = 0): void {
    this.calls += 1;
    this.inputTokens += input;
    this.outputTokens += output;
    this.retries += retries;
  }
  recordFailure(): void {
    this.failures += 1;
  }
  report(): UsageReport {
    const approxCostUsd =
      (this.inputTokens / 1000) * this.per1kInput + (this.outputTokens / 1000) * this.per1kOutput;
    return {
      provider: this.provider,
      model: this.model,
      calls: this.calls,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      retries: this.retries,
      failures: this.failures,
      approxCostUsd: Math.round(approxCostUsd * 1e6) / 1e6,
      processingMs: Date.now() - this.startedAt,
    };
  }
}
