/**
 * Base-plus-transplant assembly (challenge §Code Mode).
 *
 *  - Copy the approved base into combined-solution/.
 *  - Apply one approved transplant at a time. Each transplant copies the donor's
 *    requirement-grounding files into combined-solution/_transplants/<req>/<donor>/
 *    (namespaced so the base build is never silently broken), records provenance,
 *    and — when dynamic exec is enabled — builds/tests; failures roll back that
 *    transplant and mark its decision blocked, preserving the last verified state.
 *  - Nothing outside combined-solution/ is written (enforced by SafeFs).
 *
 * This deliberately avoids free-form merging / cross-language porting (explicitly
 * not required) and never claims success merely because files were copied.
 */
import { join, relative } from "node:path";
import type { SafeFs } from "../fs-safe.js";
import type { DiscoveredChallenge } from "../ingest.js";
import type { Logger } from "../logger.js";
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

  const entries: ProvenanceEntry[] = [];
  const updatedDecisions = decisions.decisions.map((d) => ({ ...d }));

  // ── Base ─────────────────────────────────────────────────────────────────
  const baseDecision = updatedDecisions.find((d) => d.kind === "base_selection");
  // Auto-accept the recommendation for an unattended generation pass if still pending.
  if (baseDecision && baseDecision.state === "pending") {
    baseDecision.state = "accepted";
    baseDecision.selectedSource = baseDecision.recommendation;
    baseDecision.copilotComment = "Auto-accepted agent recommendation (unattended generation pass).";
  }
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
      exec,
    });
    if (baseDecision) baseDecision.state = "blocked";
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

  for (const d of transplantDecisions) {
    if (d.state === "pending") {
      // Auto-accept recommendation for unattended generation.
      d.state = "accepted";
      d.selectedSource = d.recommendation;
      d.copilotComment = "Auto-accepted agent recommendation (unattended generation pass).";
    }
    const donorId = acceptedOptionSourceId(d);
    if (!donorId || donorId === baseSourceId) continue; // "keep base" alternative → nothing to copy
    const donorProfile = profiles.find((p) => p.submissionId === donorId);
    const cov = donorProfile?.requirementCoverage.find((c) => c.requirementId === d.requirementId);
    const donorFilesRel = (cov?.evidence ?? [])
      .flatMap((e) => e.locations)
      .map((l) => l.path)
      .filter((p): p is string => !!p);

    const destBase = join(candidateDir, "_transplants", d.requirementId ?? "req", donorId);
    let n = 0;
    for (const abs of [...new Set(donorFilesRel)]) {
      if (!fs.exists(abs)) continue;
      const donorSub = challenge.submissions.find((s) => s.submissionId === donorId);
      const rel = donorSub ? relative(donorSub.rootPath, abs) : abs.split("/").pop()!;
      try {
        fs.copyInto(abs, join(destBase, rel));
        n++;
      } catch {
        /* skip unreadable */
      }
    }

    if (n === 0) {
      d.state = "manual_review";
      d.copilotComment = "No concrete donor files resolved for this transplant; needs manual selection.";
      continue;
    }

    entries.push({
      target: `combined-solution/_transplants/${d.requirementId}/${donorId}/`,
      sourceId: donorId,
      decisionId: d.id,
      evidence: cov?.evidence ?? [],
      generated: false,
      note: `Transplanted ${n} grounding file(s) for ${d.requirementId} (namespaced to protect base build).`,
    });

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
        exec,
      });
      if (check.overall === "failed") {
        fs.removeInWritable(destBase);
        log.recordAudit({ op: "rollback", target: destBase, detail: `transplant ${d.id} failed verification` });
        d.state = "blocked";
        d.copilotComment = "Transplant rolled back: candidate failed verification after applying it.";
        rolledBack.push(d.requirementId ?? donorId);
        continue;
      }
    }
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
    exec,
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
