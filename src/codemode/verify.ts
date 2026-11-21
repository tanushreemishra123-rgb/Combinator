/**
 * Code candidate verification runner (challenge §Code verification).
 *
 * Models every required verification step: dependency installation, build,
 * application startup, organizer smoke tests, unit/integration tests, regression
 * vs base, approved-capability verification, original scorecard re-evaluation,
 * and source-integrity verification.
 *
 * HONESTY CONTRACT: a failed candidate is never reported as successful. Dynamic
 * steps (install/build/start/test) actually run commands only when exec is
 * enabled; otherwise they are recorded as `skipped` with the reason, never as
 * `passed`. Timeouts and non-zero exits are recorded as failures with captured
 * error text.
 */
import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { VerificationStep } from "../types.js";

export interface ExecOptions {
  enabled: boolean;
  cwd: string;
  timeoutMs: number;
}

export function runCommand(
  cmd: string,
  args: string[],
  opts: { cwd: string; timeoutMs: number },
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = execFile(
      cmd,
      args,
      { cwd: opts.cwd, timeout: opts.timeoutMs, maxBuffer: 8 * 1024 * 1024, shell: false },
      (err, stdout, stderr) => {
        const timedOut = !!err && (err as NodeJS.ErrnoException).code === "ETIMEDOUT";
        resolve({
          code: child.exitCode,
          stdout: String(stdout).slice(-4000),
          stderr: String(stderr).slice(-4000),
          timedOut,
        });
      },
    );
  });
}

export interface CodeVerifyInput {
  candidateDir: string;
  baseSourceId: string | null;
  buildCommands: string[];
  hasTests: boolean;
  appliedTransplants: string[];
  rolledBack: string[];
  sourceIntegrityOk: boolean;
  exec: ExecOptions;
}

function skipped(name: string, command?: string): VerificationStep {
  return {
    name,
    command,
    state: "skipped",
    detail: "Dynamic verification not executed in this pass. Re-run with --verify-exec to run it.",
  };
}

/** Locate the runnable Node application, excluding evidence-only transplant copies. */
function packageRoot(candidateDir: string): string | null {
  const visit = (dir: string, depth: number): string | null => {
    if (existsSync(join(dir, "package.json"))) return dir;
    if (depth === 0) return null;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules" || entry.name === ".git" || entry.name === "_transplants") continue;
      const found = visit(join(dir, entry.name), depth - 1);
      if (found) return found;
    }
    return null;
  };
  return existsSync(candidateDir) ? visit(candidateDir, 5) : null;
}

export async function verifyCodeCandidate(input: CodeVerifyInput): Promise<{
  steps: VerificationStep[];
  overall: "passed" | "failed" | "partial" | "not_verifiable";
  honestSummary: string;
}> {
  const steps: VerificationStep[] = [];
  const appDir = packageRoot(input.candidateDir);

  // 1. Source integrity (always evaluated).
  steps.push({
    name: "Source integrity (before/after SHA-256)",
    state: input.sourceIntegrityOk ? "passed" : "failed",
    detail: input.sourceIntegrityOk
      ? "No source artifact hash changed during processing."
      : "CRITICAL: a source artifact hash changed — see integrity report.",
  });

  // 2. Structural checks (always evaluated).
  steps.push({
    name: "Candidate assembled (base + approved transplants)",
    state: input.baseSourceId ? "passed" : "failed",
    detail: input.baseSourceId
      ? `Base ${input.baseSourceId} copied; ${input.appliedTransplants.length} transplant(s) applied, ${input.rolledBack.length} rolled back.`
      : "No Copilot-approved base could be selected; candidate not assembled. Accept or select a base decision, then regenerate.",
  });

  // 3. Dynamic steps: dependency install, build, startup, smoke, unit/integration.
  const dyn: Array<{ name: string; cmd?: [string, string[]] }> = [
    { name: "Dependency installation", cmd: ["npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts"]] },
    { name: "Build", cmd: input.buildCommands.some((c) => c.includes("build")) ? ["npm", ["run", "build"]] : undefined },
    { name: "Application startup (smoke)", cmd: undefined },
    { name: "Organizer smoke tests", cmd: undefined },
    { name: "Unit / integration tests", cmd: input.hasTests ? ["npm", ["test", "--", "--run"]] : undefined },
  ];

  for (const d of dyn) {
    if (!input.exec.enabled) {
      steps.push(skipped(d.name, d.cmd ? `${d.cmd[0]} ${d.cmd[1].join(" ")}` : undefined));
      continue;
    }
    if (!d.cmd) {
      steps.push({
        name: d.name,
        state: "not_verifiable",
        detail: "No command discovered for this step in the candidate.",
      });
      continue;
    }
    const started = Date.now();
    if (!appDir) {
      steps.push({ name: d.name, state: "not_verifiable", detail: "No runnable package.json was found outside evidence-only transplant directories." });
      continue;
    }
    const r = await runCommand(d.cmd[0], d.cmd[1], { cwd: appDir, timeoutMs: input.exec.timeoutMs });
    steps.push({
      name: d.name,
      command: `${d.cmd[0]} ${d.cmd[1].join(" ")}`,
      state: r.timedOut ? "failed" : r.code === 0 ? "passed" : "failed",
      detail: r.timedOut
        ? `Timed out after ${input.exec.timeoutMs}ms.`
        : r.code === 0
          ? "Completed with exit code 0."
          : `Exit ${r.code}. stderr tail: ${r.stderr.slice(-500)}`,
      durationMs: Date.now() - started,
    });
  }

  // 4. Regression vs base + approved-capability + scorecard re-eval (modeled).
  steps.push({
    name: "Regression comparison vs base",
    state: input.exec.enabled ? "not_verifiable" : "skipped",
    detail: input.exec.enabled
      ? "Base and candidate test suites must both run to compare; not both available in this environment."
      : "Requires dynamic execution (--verify-exec).",
  });
  steps.push({
    name: "Approved-capability verification",
    state: input.appliedTransplants.length ? "partial" : "not_verifiable",
    detail: input.appliedTransplants.length
      ? `Transplanted capabilities present in candidate under _transplants/: ${input.appliedTransplants.join(", ")}. Functional confirmation requires dynamic tests.`
      : "No transplants applied; base capabilities only.",
  });
  steps.push({
    name: "Original scorecard re-evaluation",
    state: "not_verifiable",
    detail:
      "Starter-pack reviews are normalized score stubs without a re-runnable scorecard; re-evaluation is not possible without the original scorecard definition. Not fabricated.",
  });

  // Overall + honest summary.
  const anyFailed = steps.some((s) => s.state === "failed");
  const anyPassedDynamic = steps.some(
    (s) => s.state === "passed" && /install|build|test|startup/i.test(s.name),
  );
  let overall: "passed" | "failed" | "partial" | "not_verifiable";
  if (anyFailed) overall = "failed";
  else if (!input.exec.enabled) overall = "partial";
  else if (anyPassedDynamic) overall = "partial";
  else overall = "not_verifiable";

  const honestSummary = anyFailed
    ? "Candidate did NOT fully verify. Failed steps are recorded above; the last verified candidate is preserved and affected decisions should be marked blocked. This candidate is not presented as successful."
    : input.exec.enabled
      ? "Dynamic steps that could run are recorded with real results; steps that could not be verified are marked not_verifiable (never passed). No step is reported as successful without evidence."
      : "Static and integrity checks passed. Dynamic verification was not executed in this pass (run with --verify-exec); those steps are marked skipped, not passed.";

  return { steps, overall, honestSummary };
}
