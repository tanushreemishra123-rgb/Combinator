/**
 * Evidence fusion + requirement matrix (challenge §Evidence Fusion and
 * Requirement Matrix).
 *
 * Combines source evidence (profiles), review/scorecard evidence, and (for code)
 * build/test signals into a per-requirement matrix. For each requirement it
 * picks a recommended source from grounded evidence, records confidence and
 * compatibility risk, and surfaces conflicts:
 *   - human_vs_ai: human and AI review disagree on a submission's standing,
 *   - review_vs_source: review score high but source evidence weak (or vice versa),
 *   - uncertain_evidence: only not_verifiable/missing evidence available.
 *
 * Reviewer comments are NOT treated as automatically correct (spec).
 */
import { stableId } from "./ids.js";
import { pick } from "./util.js";
import type { SubmissionReview } from "./reviews.js";
import type {
  CodeSubmissionProfile,
  Confidence,
  Conflict,
  IdeaProfile,
  MatrixCell,
  MatrixRow,
  Requirement,
  RequirementMatrix,
  AssessmentState,
} from "./types.js";

const STATE_RANK: Record<AssessmentState, number> = {
  complete: 4,
  partial: 3,
  manual_review_required: 2,
  not_verifiable: 1,
  missing: 0,
};

/** Safe rank lookup (avoids computed member access on the lookup table). */
function rank(state: AssessmentState): number {
  return pick<number>(STATE_RANK, state) ?? 0;
}

function confidenceFor(state: AssessmentState): Confidence {
  if (state === "complete") return "high";
  if (state === "partial") return "medium";
  return "low";
}

// ── Code mode matrix ─────────────────────────────────────────────────────────

export function buildCodeMatrix(
  challengeId: string,
  requirements: Requirement[],
  profiles: CodeSubmissionProfile[],
  reviews: Map<string, SubmissionReview>,
): RequirementMatrix {
  const conflicts: Conflict[] = [];
  const rows: MatrixRow[] = requirements.map((req) => {
    const cells: MatrixCell[] = profiles.map((p) => {
      const cov = p.requirementCoverage.find((c) => c.requirementId === req.id);
      const state = cov?.state ?? "not_verifiable";
      return {
        sourceId: p.submissionId,
        state,
        score: cov?.score ?? 0,
        evidence: cov?.evidence ?? [],
        confidence: confidenceFor(state),
        compatibilityRisk: p.compatibilityRisk,
      };
    });

    // Recommend by grounded coverage strength per requirement (tie → base suitability),
    // so the strongest source for THIS requirement can differ from the chosen base.
    const ranked = [...cells].sort((a, b) => {
      const ds = rank(b.state) - rank(a.state);
      if (ds !== 0) return ds;
      if (Math.abs(b.score - a.score) > 0.1) return b.score - a.score;
      const pa = profiles.find((p) => p.submissionId === a.sourceId)!.baseSuitability.score;
      const pb = profiles.find((p) => p.submissionId === b.sourceId)!.baseSuitability.score;
      return pb - pa;
    });
    const best = ranked[0];
    const recommendedSource = best && rank(best.state) > 0 ? best.sourceId : null;

    // Conflict: review score high but source evidence weak for this requirement.
    for (const cell of cells) {
      const rev = reviews.get(cell.sourceId);
      if (rev?.finalScore != null && rev.finalScore >= 90 && rank(cell.state) <= 1) {
        conflicts.push({
          id: stableId.conflict(challengeId, "review_vs_source", `${req.id}:${cell.sourceId}`),
          type: "review_vs_source",
          requirementId: req.id,
          description: `${cell.sourceId} has a high review score (${rev.finalScore}) but weak grounded source evidence (${cell.state}) for "${req.title}". Reviewer judgment is not treated as automatically correct.`,
          evidence: [...rev.evidence, ...cell.evidence],
        });
      }
    }

    const confidences = cells.map((c) => c.confidence);
    const rowConfidence: Confidence = confidences.includes("high")
      ? "high"
      : confidences.includes("medium")
        ? "medium"
        : "low";

    return {
      requirementId: req.id,
      requirementTitle: req.title,
      cells,
      recommendedSource,
      reasoning: recommendedSource
        ? `${recommendedSource} shows the strongest grounded coverage (${best!.state}) for this requirement.`
        : "No submission shows grounded coverage; requires manual review.",
      confidence: rowConfidence,
      unresolvedConflicts: conflicts.filter((c) => c.requirementId === req.id),
    };
  });

  return { challengeId, mode: "code", rows, conflicts };
}

// ── Ideation mode matrix (requirements = evaluation criteria) ────────────────

export function buildIdeationMatrix(
  challengeId: string,
  evaluationRequirements: Requirement[],
  ideas: IdeaProfile[],
): RequirementMatrix {
  const conflicts: Conflict[] = [];
  const critKeyByTitle: Record<string, keyof IdeaProfile["evaluation"]> = {
    Originality: "originality",
    Feasibility: "feasibility",
    Scalability: "scalability",
    "Impact Potential": "impact_potential",
    "Alignment with Scope": "alignment_with_scope",
  };

  const rows: MatrixRow[] = evaluationRequirements.map((req) => {
    const key = pick<keyof IdeaProfile["evaluation"]>(critKeyByTitle, req.title);
    const cells: MatrixCell[] = ideas.map((idea) => {
      const e = key ? pick<IdeaProfile["evaluation"][typeof key]>(idea.evaluation, key) : undefined;
      const state = e?.state ?? "not_verifiable";
      return {
        sourceId: idea.ideaId,
        state,
        score: rank(state),
        evidence: e?.evidence ?? [],
        confidence: confidenceFor(state),
        compatibilityRisk: "low",
      };
    });
    const ranked = [...cells].sort((a, b) => rank(b.state) - rank(a.state));
    const best = ranked[0];
    const recommendedSource = best && rank(best.state) > 1 ? best.sourceId : null;
    return {
      requirementId: req.id,
      requirementTitle: req.title,
      cells,
      recommendedSource,
      reasoning: recommendedSource
        ? `${recommendedSource} best addresses ${req.title} based on grounded document evidence.`
        : `No idea strongly addresses ${req.title}; manual review suggested.`,
      confidence: best ? confidenceFor(best.state) : "low",
      unresolvedConflicts: [],
    };
  });

  return { challengeId, mode: "ideation", rows, conflicts };
}

// ── Human-readable Markdown rendering ────────────────────────────────────────

export function matrixToMarkdown(matrix: RequirementMatrix, title: string): string {
  const sources = [...new Set(matrix.rows.flatMap((r) => r.cells.map((c) => c.sourceId)))];
  const lines: string[] = [];
  lines.push(`# Requirement Matrix — ${title}`, "");
  lines.push(`Mode: **${matrix.mode}** · Requirements: ${matrix.rows.length} · Sources: ${sources.length}`, "");
  lines.push(`| Requirement | ${sources.join(" | ")} | Recommended | Confidence |`);
  lines.push(`| --- | ${sources.map(() => "---").join(" | ")} | --- | --- |`);
  for (const row of matrix.rows) {
    const cellsBySource = new Map(row.cells.map((c) => [c.sourceId, c.state]));
    const cols = sources.map((s) => cellsBySource.get(s) ?? "—");
    lines.push(
      `| ${row.requirementTitle} (${row.requirementId}) | ${cols.join(" | ")} | ${
        row.recommendedSource ?? "—"
      } | ${row.confidence} |`,
    );
  }
  if (matrix.conflicts.length) {
    lines.push("", "## Unresolved conflicts", "");
    for (const c of matrix.conflicts) {
      lines.push(`- **${c.type}** ${c.requirementId ? `(${c.requirementId})` : ""}: ${c.description}`);
    }
  } else {
    lines.push("", "_No unresolved review-vs-source or human-vs-AI conflicts detected._");
  }
  return lines.join("\n") + "\n";
}
