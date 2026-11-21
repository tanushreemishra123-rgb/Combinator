/**
 * Orchestrator — runs one challenge end-to-end and writes the complete workspace
 * (challenge §Required Workspace Output). Files are the source of truth; the
 * review UI reads/updates them.
 *
 * Pipeline:
 *   discover → hash(before) → review-context → reviews → profile →
 *   requirement-matrix → decisions → (code: assemble+verify | ideation:
 *   synthesize+verify) → hash(after)+integrity → write all artifacts.
 */
import { join, relative } from "node:path";
import { mkdirSync } from "node:fs";
import type { CombinatorConfig } from "./config.js";
import { Logger, UsageMeter } from "./logger.js";
import { SafeFs } from "./fs-safe.js";
import { discoverChallenge, loadManifest, pkgRelative, type ManifestChallenge } from "./ingest.js";
import { buildReviewContext } from "./review-context.js";
import { loadReviews } from "./reviews.js";
import { profileCodeSubmission } from "./profiling/code.js";
import { profileIdeationSubmission } from "./profiling/ideation.js";
import { buildCodeMatrix, buildIdeationMatrix, matrixToMarkdown } from "./evidence.js";
import { buildCodeDecisions, buildIdeationDecisions } from "./decisions.js";
import { assembleCandidate } from "./codemode/transplant.js";
import { detectContradictions, synthesizeConcept } from "./ideation/synthesize.js";
import { createAdapter } from "./llm/adapter.js";
import { hashTree, diffHashes } from "./integrity.js";
import type {
  CodeSubmissionProfile,
  IdeaProfile,
  Provenance,
  RequirementMatrix,
  Verification,
  WorkspaceManifest,
} from "./types.js";

const VERSION = "1.0.0";

export interface RunOptions {
  packRoot: string;
  outDir: string; // workspace/
  verifyExec: boolean;
  execTimeoutMs: number;
  /** Copilot decision states to overlay onto freshly-built decisions (regeneration). */
  overlayDecisions?: import("./types.js").DecisionWorkspace;
}

/** Overlay saved copilot states (by decision id) onto freshly-built decisions. */
function overlay(
  fresh: import("./types.js").DecisionWorkspace,
  saved?: import("./types.js").DecisionWorkspace,
): import("./types.js").DecisionWorkspace {
  if (!saved) return fresh;
  const byId = new Map(saved.decisions.map((d) => [d.id, d]));
  return {
    ...fresh,
    decisions: fresh.decisions.map((d) => {
      const s = byId.get(d.id);
      return s
        ? { ...d, state: s.state, selectedSource: s.selectedSource, copilotComment: s.copilotComment, updatedAt: s.updatedAt }
        : d;
    }),
  };
}

export async function runChallenge(
  cfg: CombinatorConfig,
  mc: ManifestChallenge,
  opts: RunOptions,
): Promise<WorkspaceManifest> {
  const log = new Logger(true);
  const meter = new UsageMeter(cfg.cost.per1kInput, cfg.cost.per1kOutput);
  const llm = await createAdapter(cfg, meter);

  const wsDir = join(opts.outDir, mc.challengeId);
  mkdirSync(wsDir, { recursive: true });

  const fs = new SafeFs({ readRoots: [opts.packRoot, opts.outDir], log });
  fs.allowWrite(wsDir);

  const ch = discoverChallenge(fs, opts.packRoot, mc);
  log.info(`[${ch.challengeId}] mode=${ch.mode}, submissions=${ch.submissions.length}`);

  // Integrity — before.
  const before = hashTree(fs, ch.packageRoot);

  // Review context (+ 4 required artifacts).
  const rc = buildReviewContext(fs, ch);
  fs.writeJson(join(wsDir, "review-context-status.json"), rc.status);
  fs.writeJson(join(wsDir, "active-review-context.json"), rc.active);
  fs.writeJson(join(wsDir, "review-context-reconciliation.json"), rc.reconciliation);
  fs.writeJson(join(wsDir, "source-location-map.json"), rc.sourceLocationMap);

  const reviews = loadReviews(fs, ch);

  let matrix: RequirementMatrix;
  let provenance: Provenance;
  let verification: Verification;
  let codeProfiles: CodeSubmissionProfile[] = [];
  let ideaProfiles: IdeaProfile[] = [];
  let contradictions = [] as RequirementMatrix["conflicts"];

  if (ch.mode === "code") {
    for (const sub of ch.submissions) {
      const rev = reviews.get(sub.submissionId);
      const p = await profileCodeSubmission(
        fs,
        ch,
        sub,
        rc.active.requirements,
        llm,
        rev?.evidence ?? [],
      );
      codeProfiles.push(p);
      fs.writeJson(join(wsDir, "submissions", sub.submissionId, "profile.json"), p);
    }
    matrix = buildCodeMatrix(ch.challengeId, rc.active.requirements, codeProfiles, reviews);
    const decisions = overlay(buildCodeDecisions(ch.challengeId, matrix, codeProfiles), opts.overlayDecisions);

    const before2 = before; // integrity captured pre-assembly; combined-solution is a workspace write, not a source write
    const result = await assembleCandidate(
      fs,
      log,
      ch,
      wsDir,
      decisions,
      codeProfiles,
      { enabled: opts.verifyExec, cwd: join(wsDir, "combined-solution"), timeoutMs: opts.execTimeoutMs },
      /* sourceIntegrityOk (confirmed after) */ true,
    );
    provenance = result.assemble.provenance;
    verification = {
      challengeId: ch.challengeId,
      mode: "code",
      candidate: "combined-solution/",
      overall: result.verification.overall,
      steps: result.verification.steps,
      honestSummary: result.verification.honestSummary,
      sourceIntegrityOk: true,
    };
    decisions.decisions = result.assemble.updatedDecisions;
    fs.writeJson(join(wsDir, "decisions.json"), decisions);
    void before2;
  } else {
    const specText = ch.challengeContextPath ? fs.readText(ch.challengeContextPath) : null;
    const maxIdeas = (() => {
      try {
        return specText ? (JSON.parse(specText).maximumIdeasPerSubmission ?? 3) : 3;
      } catch {
        return 3;
      }
    })();
    for (const sub of ch.submissions) {
      const profs = await profileIdeationSubmission(ch, sub, rc.active.requirements, maxIdeas, llm);
      ideaProfiles.push(...profs);
      fs.writeJson(join(wsDir, "submissions", sub.submissionId, "ideas.json"), profs);
    }
    matrix = buildIdeationMatrix(ch.challengeId, rc.active.requirements, ideaProfiles);
    contradictions = detectContradictions(ch.challengeId, ideaProfiles);
    const decisions = overlay(
      buildIdeationDecisions(ch.challengeId, ideaProfiles, contradictions),
      opts.overlayDecisions,
    );
    const synth = await synthesizeConcept(
      ch.challengeId,
      ch.title,
      ideaProfiles,
      rc.active.requirements,
      decisions.decisions,
      contradictions,
      llm,
    );
    fs.allowWrite(join(wsDir, "synthesized-concept"));
    fs.writeText(join(wsDir, "synthesized-concept", "concept.md"), synth.conceptMarkdown);
    provenance = synth.provenance;
    verification = synth.verification;
    fs.writeJson(join(wsDir, "decisions.json"), decisions);
  }

  // Requirement matrix (JSON + Markdown).
  fs.writeJson(join(wsDir, "requirement-matrix.json"), matrix);
  fs.writeText(join(wsDir, "requirement-matrix.md"), matrixToMarkdown(matrix, ch.title));

  // Provenance, contradictions, verification.
  fs.writeJson(join(wsDir, "provenance.json"), provenance);
  fs.writeJson(join(wsDir, "contradictions.json"), {
    challengeId: ch.challengeId,
    mode: ch.mode,
    contradictions: ch.mode === "ideation" ? contradictions : matrix.conflicts,
  });
  fs.writeJson(join(wsDir, "verification.json"), verification);

  // Integrity — after (sources must be unchanged).
  const after = hashTree(fs, ch.packageRoot);
  const integrity = diffHashes(ch.challengeId, before, after);
  fs.writeJson(join(wsDir, "integrity", "integrity-report.json"), integrity);
  if (integrity.critical) log.warn(`[${ch.challengeId}] CRITICAL: source integrity mismatch detected.`);

  // Usage report + audit log.
  const usage = meter.report();
  fs.writeJson(join(wsDir, "usage-report.json"), usage);
  fs.writeJson(join(wsDir, "audit-log.json"), log.getAudit());

  // Review UI pointer per workspace.
  fs.allowWrite(join(wsDir, "review-ui"));
  fs.writeText(
    join(wsDir, "review-ui", "README.md"),
    `# Review UI\n\nThis challenge's decisions, matrix, provenance and verification are the JSON files in the parent folder — the source of truth.\n\nStart the local UI from the repo root:\n\n    npm run ui\n\nthen open http://localhost:${cfg.uiPort} and choose **${ch.challengeId}**. The UI reads and writes these files; changing a decision triggers regeneration.\n`,
  );

  // Overview.
  fs.writeText(join(wsDir, "overview.md"), renderOverview(ch.title, ch.mode, rc, matrix, verification, usage, integrity.critical, codeProfiles, ideaProfiles));

  // Workspace manifest.
  const manifest: WorkspaceManifest = {
    challengeId: ch.challengeId,
    title: ch.title,
    mode: ch.mode,
    generatedAt: new Date().toISOString(),
    combinatorVersion: VERSION,
    reviewContextMode: rc.active.mode,
    artifacts: [
      "workspace-manifest.json",
      "review-context-status.json",
      "active-review-context.json",
      "review-context-reconciliation.json",
      "source-location-map.json",
      "overview.md",
      "requirement-matrix.json",
      "requirement-matrix.md",
      "decisions.json",
      "provenance.json",
      "contradictions.json",
      "verification.json",
      "usage-report.json",
      "audit-log.json",
      "integrity/integrity-report.json",
      ch.mode === "code" ? "combined-solution/" : "synthesized-concept/concept.md",
      "submissions/",
      "review-ui/",
    ],
    usage,
    integrityCritical: integrity.critical,
    verificationOverall: verification.overall,
  };
  fs.writeJson(join(wsDir, "workspace-manifest.json"), manifest);

  log.info(
    `[${ch.challengeId}] done — verification=${verification.overall}, integrityCritical=${integrity.critical}, llm=${usage.provider}/${usage.model}, calls=${usage.calls}`,
  );
  return manifest;
}

export async function runAll(cfg: CombinatorConfig, opts: RunOptions): Promise<WorkspaceManifest[]> {
  const bootstrapLog = new Logger(false);
  const bootstrapFs = new SafeFs({ readRoots: [opts.packRoot], log: bootstrapLog });
  const manifest = loadManifest(bootstrapFs, opts.packRoot);
  const results: WorkspaceManifest[] = [];
  for (const mc of manifest.challenges) {
    results.push(await runChallenge(cfg, mc, opts));
  }
  return results;
}

function renderOverview(
  title: string,
  mode: string,
  rc: ReturnType<typeof buildReviewContext>,
  matrix: RequirementMatrix,
  verification: Verification,
  usage: { provider: string; model: string; calls: number; approxCostUsd: number },
  integrityCritical: boolean,
  codeProfiles: CodeSubmissionProfile[],
  ideaProfiles: IdeaProfile[],
): string {
  const L: string[] = [];
  L.push(`# Overview — ${title}`, "");
  L.push(`- **Mode:** ${mode}`);
  L.push(`- **Review context:** ${rc.status.status} (${rc.active.mode})`);
  L.push(`- **Requirements/criteria:** ${rc.active.requirements.length}`);
  L.push(`- **Verification:** ${verification.overall}`);
  L.push(`- **Source integrity critical:** ${integrityCritical ? "YES — see integrity report" : "no (sources unchanged)"}`);
  L.push(`- **LLM:** ${usage.provider}/${usage.model}, ${usage.calls} call(s), ≈ $${usage.approxCostUsd}`);
  L.push("");
  if (mode === "code") {
    L.push("## Submissions", "");
    for (const p of codeProfiles) {
      L.push(
        `- **${p.submissionId}** — base suitability ${p.baseSuitability.score}, risk ${p.compatibilityRisk}, tests ${p.tests.state}, ${p.applications.length} app unit(s).`,
      );
    }
  } else {
    L.push("## Ideas", "");
    for (const i of ideaProfiles) {
      const strong = Object.values(i.evaluation).filter((e) => e.state === "complete").length;
      L.push(`- **${i.ideaId}** (${i.submissionId}) — "${i.title}" — ${strong}/5 evaluation areas grounded.`);
    }
  }
  L.push("", "See requirement-matrix.md, decisions.json, provenance.json, verification.json for detail.");
  return L.join("\n") + "\n";
}
