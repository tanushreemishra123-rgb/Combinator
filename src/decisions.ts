/**
 * Copilot decision workspace (challenge §Copilot Decision Workflow).
 *
 * Each proposed selection becomes a Decision with options, recommendation,
 * evidence, reasoning, risk, state, selectedSource and copilot comment. The agent
 * proposes (state=pending, selectedSource=recommendation); the Copilot accepts,
 * rejects, selects an alternative, blocks, or defers via the review UI / CLI.
 *
 * Code mode decisions: one base_selection + one transplant per requirement whose
 * recommended source differs from the base.
 * Ideation decisions: one idea_element per idea + one contradiction per detected
 * contradiction.
 */
import { stableId } from "./ids.js";
import type { CodeSubmissionProfile, IdeaProfile } from "./types.js";
import type {
  Decision,
  DecisionOption,
  DecisionState,
  DecisionWorkspace,
  RequirementMatrix,
  Conflict,
  CompatibilityRisk,
} from "./types.js";

const now = () => new Date().toISOString();
/**
 * Stable sentinel for a freshly-proposed decision the Copilot has not yet acted
 * on. Keeping it constant makes the generated decisions.json reproducible; a real
 * ISO timestamp is written only when applyDecisionChange records an actual change.
 */
const PROPOSED = "proposed";

function option(decisionKey: string, sourceId: string, label: string, risk: CompatibilityRisk): DecisionOption {
  return { id: stableId.option(decisionKey, sourceId), sourceId, label, evidence: [], compatibilityRisk: risk };
}

// ── Code mode ────────────────────────────────────────────────────────────────

export function buildCodeDecisions(
  challengeId: string,
  matrix: RequirementMatrix,
  profiles: CodeSubmissionProfile[],
): DecisionWorkspace {
  const decisions: Decision[] = [];

  // 1) Base selection — the submission that wins the most requirements (by grounded
  //    coverage strength), with overall base suitability as the tiebreak. This keeps
  //    the base and the per-requirement winners consistent, so transplants are the
  //    exceptions rather than a wholesale rebuild.
  const candidates = profiles.filter((p) => p.applications.length > 0);
  const wins = new Map<string, number>();
  for (const row of matrix.rows) {
    if (row.recommendedSource) wins.set(row.recommendedSource, (wins.get(row.recommendedSource) ?? 0) + 1);
  }
  const baseRanked = [...candidates].sort((a, b) => {
    const dw = (wins.get(b.submissionId) ?? 0) - (wins.get(a.submissionId) ?? 0);
    if (dw !== 0) return dw;
    return b.baseSuitability.score - a.baseSuitability.score;
  });
  const baseKey = "base";
  const baseOptions = baseRanked.map((p) =>
    option(
      baseKey,
      p.submissionId,
      `${p.submissionId} (wins ${wins.get(p.submissionId) ?? 0} req(s), suitability ${p.baseSuitability.score})`,
      p.compatibilityRisk,
    ),
  );
  const baseRec = baseOptions[0];
  const baseDecision: Decision = {
    id: stableId.decision(challengeId, "base_selection", baseKey),
    kind: "base_selection",
    title: "Select the runnable base",
    options: baseOptions,
    recommendation: baseRec?.id ?? "",
    reasoning: baseRanked.length
      ? `${baseRanked[0]!.submissionId} has the highest grounded base suitability (${baseRanked[0]!.baseSuitability.score}): ${baseRanked[0]!.baseSuitability.reasoning}`
      : "No submission has analyzable application code.",
    risk: baseRanked[0]?.compatibilityRisk ?? "unknown",
    state: baseRanked.length ? "pending" : "blocked",
    selectedSource: baseRec?.id ?? null,
    copilotComment: null,
    regenerationRequired: true,
    updatedAt: PROPOSED,
  };
  decisions.push(baseDecision);
  const baseSourceId = baseRanked[0]?.submissionId ?? null;

  // 2) Transplant ONLY where a non-base source beats the base by a clear margin
  //    for that requirement (or the base simply lacks it). Otherwise keep the base.
  const TRANSPLANT_MARGIN = 3;
  for (const row of matrix.rows) {
    if (!row.recommendedSource || row.recommendedSource === baseSourceId) continue;
    const baseCell = row.cells.find((c) => c.sourceId === baseSourceId);
    const recCell = row.cells.find((c) => c.sourceId === row.recommendedSource);
    if (baseCell && recCell) {
      const baseHasIt = baseCell.state === "complete" || baseCell.state === "partial";
      const margin = recCell.score - baseCell.score;
      // Skip the transplant when the base already covers it and the margin is small.
      if (baseHasIt && margin < TRANSPLANT_MARGIN) continue;
    }
    const key = `transplant:${row.requirementId}`;
    const recProfile = profiles.find((p) => p.submissionId === row.recommendedSource);
    const opts = [
      option(key, row.recommendedSource, `Transplant from ${row.recommendedSource}`, recProfile?.compatibilityRisk ?? "unknown"),
      ...(baseSourceId ? [option(key, baseSourceId, `Keep base (${baseSourceId}) as-is`, "low")] : []),
    ];
    decisions.push({
      id: stableId.decision(challengeId, "transplant", key),
      kind: "transplant",
      title: `Transplant for "${row.requirementTitle}"`,
      requirementId: row.requirementId,
      options: opts,
      recommendation: opts[0]!.id,
      reasoning: `${row.recommendedSource} covers "${row.requirementTitle}" more strongly than the base. ${row.reasoning}`,
      risk: recProfile?.compatibilityRisk ?? "unknown",
      state: "pending",
      selectedSource: opts[0]!.id,
      copilotComment: null,
      regenerationRequired: true,
      updatedAt: PROPOSED,
    });
  }

  return { challengeId, mode: "code", decisions };
}

// ── Ideation mode ────────────────────────────────────────────────────────────

export function buildIdeationDecisions(
  challengeId: string,
  ideas: IdeaProfile[],
  contradictions: Conflict[],
): DecisionWorkspace {
  const decisions: Decision[] = [];

  for (const idea of ideas) {
    const key = `idea:${idea.ideaId}`;
    const strong = Object.values(idea.evaluation).filter((e) => e.state === "complete").length;
    decisions.push({
      id: stableId.decision(challengeId, "idea_element", key),
      kind: "idea_element",
      title: `Include idea "${idea.title}" (${idea.submissionId})`,
      options: [
        option(key, idea.ideaId, `Include "${idea.title}"`, "low"),
        option(key, `${idea.ideaId}:exclude`, "Exclude this idea", "low"),
      ],
      recommendation: stableId.option(key, idea.ideaId),
      reasoning: `Idea addresses ${strong}/5 evaluation areas with grounded evidence.`,
      risk: "low",
      state: "pending",
      selectedSource: stableId.option(key, idea.ideaId),
      copilotComment: null,
      regenerationRequired: true,
      updatedAt: PROPOSED,
    });
  }

  for (const c of contradictions) {
    const key = `contradiction:${c.id}`;
    decisions.push({
      id: stableId.decision(challengeId, "contradiction", key),
      kind: "contradiction",
      title: `Resolve contradiction: ${c.description.slice(0, 60)}…`,
      options: [
        option(key, "keep_both_labeled", "Keep both positions, labeled as a trade-off", "low"),
        option(key, "pick_a", "Adopt the first position", "medium"),
        option(key, "pick_b", "Adopt the second position", "medium"),
      ],
      recommendation: stableId.option(key, "keep_both_labeled"),
      reasoning: c.description,
      risk: "medium",
      state: "unresolved",
      selectedSource: null,
      copilotComment: null,
      regenerationRequired: true,
      updatedAt: PROPOSED,
    });
  }

  return { challengeId, mode: "ideation", decisions };
}

// ── State transitions (used by the review UI / CLI) ──────────────────────────

const ALLOWED: Record<DecisionState, DecisionState[]> = {
  pending: ["accepted", "rejected", "alternative_selected", "blocked", "manual_review", "unresolved"],
  accepted: ["rejected", "alternative_selected", "blocked", "manual_review", "unresolved", "pending"],
  rejected: ["accepted", "alternative_selected", "pending", "manual_review", "unresolved"],
  alternative_selected: ["accepted", "rejected", "pending", "blocked", "manual_review", "unresolved"],
  blocked: ["manual_review", "pending", "unresolved"],
  manual_review: ["accepted", "rejected", "alternative_selected", "blocked", "pending", "unresolved"],
  unresolved: ["accepted", "rejected", "alternative_selected", "blocked", "manual_review", "pending"],
};

export function applyDecisionChange(
  d: Decision,
  change: { state: DecisionState; selectedOptionId?: string; comment?: string },
): { ok: true; decision: Decision } | { ok: false; error: string } {
  if (!ALLOWED[d.state].includes(change.state) && change.state !== d.state) {
    return { ok: false, error: `Illegal transition ${d.state} → ${change.state}` };
  }
  let selectedSource = d.selectedSource;
  if (change.state === "accepted") selectedSource = d.recommendation;
  if (change.state === "alternative_selected") {
    if (!change.selectedOptionId || !d.options.some((o) => o.id === change.selectedOptionId)) {
      return { ok: false, error: "alternative_selected requires a valid selectedOptionId" };
    }
    selectedSource = change.selectedOptionId;
  }
  if (change.state === "rejected" || change.state === "blocked") selectedSource = null;
  return {
    ok: true,
    decision: {
      ...d,
      state: change.state,
      selectedSource,
      copilotComment: change.comment ?? d.copilotComment,
      updatedAt: now(),
    },
  };
}
