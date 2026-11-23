/**
 * Base-plus-transplant assembly (challenge §Code Mode).
 *
 *  - Copy the approved base into combined-solution/.
 *  - Apply one Copilot-approved transplant at a time. A transplant is permitted
 *    only when an evidence file maps to an existing, same-type source path in
 *    the runnable base. The target is snapshotted, replaced, verified, then
 *    restored on failure. Unsafe cross-stack copies remain manual review.
 *  - Nothing outside combined-solution/ is written (enforced by SafeFs).
 *
 * This deliberately avoids free-form merging / cross-language porting (explicitly
 * not required) and never claims success merely because files were copied.
 */
import { extname, join, relative } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import type { SafeFs } from "../fs-safe.js";
import type { DiscoveredChallenge } from "../ingest.js";
import type { Logger } from "../logger.js";
import { pick } from "../util.js";
import type {
  CodeSubmissionProfile,
  Decision,
  DecisionWorkspace,
  Provenance,
  ProvenanceEntry,
} from "../types.js";
import { verifyCodeCandidate, type ExecOptions } from "./verify.js";

export interface AssembleResult {
  provenance: Provenance;
  appliedTransplants: string[];
  rolledBack: string[];
  baseSourceId: string | null;
  buildCommands: string[];
  hasTests: boolean;
  updatedDecisions: Decision[];
}

function fixtureCommands(fs: SafeFs, challenge: DiscoveredChallenge): Partial<Record<"install" | "build" | "start" | "test" | "smokeTest", string>> {
  if (!challenge.verificationConfigPath) return {};
  try {
    const parsed = JSON.parse(fs.readText(challenge.verificationConfigPath)) as { commands?: Record<string, unknown> };
    const commands = parsed.commands ?? {};
    return Object.fromEntries(
      ["install", "build", "start", "test", "smokeTest"].flatMap((key) => {
        const value = pick(commands, key);
        return typeof value === "string" ? [[key, value]] : [];
      }),
    ) as Partial<Record<"install" | "build" | "start" | "test" | "smokeTest", string>>;
  } catch {
    return {};
  }
}

function acceptedOptionSourceId(d: Decision): string | null {
  if (d.state === "accepted") {
    const rec = d.options.find((o) => o.id === d.recommendation);
    return rec?.sourceId ?? null;
  }
  if (d.state === "alternative_selected" && d.selectedSource) {
    const opt = d.options.find((o) => o.id === d.selectedSource);
    return opt?.sourceId ?? null;
  }
  return null;
}

/** A path inside a source tree that can safely be mapped between compatible apps. */
function logicalSourceSuffix(path: string): string | null {
  const normalized = path.replace(/\\/g, "/");
  for (const anchor of ["/src/", "/app/", "/lib/", "/components/"]) {
    const index = normalized.lastIndexOf(anchor);
    if (index >= 0) return normalized.slice(index + 1);
  }
  return null;
}

function candidateApplicationRoot(candidateDir: string): string | null {
  const queue: Array<{ path: string; depth: number }> = [{ path: candidateDir, depth: 0 }];
  while (queue.length) {
    const current = queue.shift()!;
    if (current.depth > 5) continue;
    if (existsSync(join(current.path, "package.json"))) return current.path;
    try {
      for (const entry of readdirSync(current.path, { withFileTypes: true })) {
        if (!entry.isDirectory() || ["node_modules", ".git", ".combinator-snapshots"].includes(entry.name)) continue;
        queue.push({ path: join(current.path, entry.name), depth: current.depth + 1 });
      }
    } catch {
      // An unreadable directory simply cannot be a transplant target.
    }
  }
  return null;
}

export async function assembleCandidate(
  fs: SafeFs,
  log: Logger,
  challenge: DiscoveredChallenge,
  workspaceDir: string,
  decisions: DecisionWorkspace,
  profiles: CodeSubmissionProfile[],
  exec: ExecOptions,
  sourceIntegrityOk: boolean,
): Promise<{ assemble: AssembleResult; verification: Awaited<ReturnType<typeof verifyCodeCandidate>> }> {
  const candidateDir = join(workspaceDir, "combined-solution");
  fs.allowWrite(candidateDir);
  // Regeneration must never leave a previous candidate visible when the current
  // decision set has no approved base or transplant.
  fs.removeInWritable(candidateDir);
  fs.mkdirp(candidateDir);

  const entries: ProvenanceEntry[] = [];
  const verificationCommands = fixtureCommands(fs, challenge);
  const auditedExec: ExecOptions = {
    ...exec,
    audit: (detail) => log.recordAudit({ op: "exec", target: "combined-solution/", detail }),
  };
  const updatedDecisions = decisions.decisions.map((d) => ({ ...d }));

  // ── Base ─────────────────────────────────────────────────────────────────
  const baseDecision = updatedDecisions.find((d) => d.kind === "base_selection");
  const baseSourceId = baseDecision ? acceptedOptionSourceId(baseDecision) : null;
  const baseProfile = profiles.find((p) => p.submissionId === baseSourceId);
  const baseSub = challenge.submissions.find((s) => s.submissionId === baseSourceId);

  if (!baseSourceId || !baseSub || baseSub.files.length === 0) {
    const verification = await verifyCodeCandidate({
      candidateDir,
      baseSourceId: null,
      buildCommands: [],
      hasTests: false,
      appliedTransplants: [],
      rolledBack: [],
      sourceIntegrityOk,
      fixtureCommands: verificationCommands,
      exec: auditedExec,
    });
    // A pending decision is awaiting Copilot action, not a failed candidate.
    // Preserve it so the UI/CLI can accept or choose an alternative and then
    // regenerate. A decision that was already approved but cannot be resolved
    // is a genuine block.
    if (baseDecision && baseDecision.state !== "pending") baseDecision.state = "blocked";
    return {
      assemble: {
        provenance: { challengeId: challenge.challengeId, mode: "code", entries },
        appliedTransplants: [],
        rolledBack: [],
        baseSourceId: null,
        buildCommands: [],
        hasTests: false,
        updatedDecisions,
      },
      verification,
    };
  }

  // Copy base tree (skip heavy/generated dirs).
  let copied = 0;
  for (const abs of baseSub.files) {
    const rel = relative(baseSub.rootPath, abs);
    fs.copyInto(abs, join(candidateDir, rel));
    copied++;
  }
  log.info(`Base ${baseSourceId}: copied ${copied} file(s) into combined-solution/.`);
  entries.push({
    target: "combined-solution/ (base)",
    sourceId: baseSourceId,
    sourcePath: relative(challenge.packageRoot, baseSub.rootPath),
    decisionId: baseDecision!.id,
    evidence: baseProfile?.architecture.evidence ?? [],
    generated: false,
    note: `Base copied verbatim (${copied} files).`,
  });

  // ── Transplants (one at a time) ────────────────────────────────────────────
  const applied: string[] = [];
  const rolledBack: string[] = [];
  const transplantDecisions = updatedDecisions.filter((d) => d.kind === "transplant");
  const appRoot = candidateApplicationRoot(candidateDir);

  for (const d of transplantDecisions) {
    const donorId = acceptedOptionSourceId(d);
    if (!donorId || donorId === baseSourceId) continue; // "keep base" alternative → nothing to copy
    const donorProfile = profiles.find((p) => p.submissionId === donorId);
    const cov = donorProfile?.requirementCoverage.find((c) => c.requirementId === d.requirementId);
    const donorFilesRel = (cov?.evidence ?? [])
      .flatMap((e) => e.locations)
      .map((l) => l.path)
      .filter((p): p is string => !!p);

    const snapshotDir = join(candidateDir, ".combinator-snapshots", d.id);
    const changed: Array<{ source: string; target: string; snapshot: string }> = [];
    for (const abs of [...new Set(donorFilesRel)]) {
      if (!fs.exists(abs)) continue;
      const suffix = logicalSourceSuffix(abs);
      if (!suffix || !appRoot) continue;
      const target = join(appRoot, suffix);
      // Never add an orphan file or overwrite a different language. A Copilot
      // must explicitly resolve those cases rather than the tool guessing.
      if (!fs.exists(target) || extname(abs).toLowerCase() !== extname(target).toLowerCase()) continue;
      try {
        const snapshot = join(snapshotDir, suffix);
        fs.copyInto(target, snapshot);
        fs.copyInto(abs, target);
        changed.push({ source: abs, target, snapshot });
      } catch {
        /* skip unreadable */
      }
    }

    if (changed.length === 0) {
      d.state = "manual_review";
      d.copilotComment = "No compatible donor-to-base source path was found. Copilot must select or map a safe integration path.";
      continue;
    }

    for (const change of changed) {
      entries.push({
        target: relative(workspaceDir, change.target),
        sourceId: donorId,
        sourcePath: relative(challenge.packageRoot, change.source),
        decisionId: d.id,
        evidence: cov?.evidence ?? [],
        generated: false,
        note: `Compatible source replacement for ${d.requirementId}; snapshot retained until verification completes.`,
      });
    }

    // Verify after this transplant when exec is enabled; roll back on failure.
    if (exec.enabled) {
      const check = await verifyCodeCandidate({
        candidateDir,
        baseSourceId,
        buildCommands: baseProfile?.build.commands ?? [],
        hasTests: baseProfile?.tests.state === "complete",
        appliedTransplants: [...applied, d.requirementId ?? donorId],
        rolledBack,
        sourceIntegrityOk,
        fixtureCommands: verificationCommands,
        exec: auditedExec,
      });
      if (check.overall === "failed") {
        for (const change of changed) fs.copyInto(change.snapshot, change.target);
        fs.removeInWritable(snapshotDir);
        log.recordAudit({ op: "rollback", target: snapshotDir, detail: `transplant ${d.id} failed verification; restored ${changed.length} file(s)` });
        d.state = "blocked";
        d.copilotComment = "Transplant rolled back: candidate failed verification after applying it.";
        rolledBack.push(d.requirementId ?? donorId);
        continue;
      }
    }
    fs.removeInWritable(snapshotDir);
    applied.push(d.requirementId ?? donorId);
  }

  const verification = await verifyCodeCandidate({
    candidateDir,
    baseSourceId,
    buildCommands: baseProfile?.build.commands ?? [],
    hasTests: baseProfile?.tests.state === "complete",
    appliedTransplants: applied,
    rolledBack,
    sourceIntegrityOk,
    fixtureCommands: verificationCommands,
    exec: auditedExec,
  });

  return {
    assemble: {
      provenance: { challengeId: challenge.challengeId, mode: "code", entries },
      appliedTransplants: applied,
      rolledBack,
      baseSourceId,
      buildCommands: baseProfile?.build.commands ?? [],
      hasTests: baseProfile?.tests.state === "complete",
      updatedDecisions,
    },
    verification,
  };
}
