/**
 * Deterministic, stable ID generation.
 *
 * When review context is absent the Combinator must "generate deterministic
 * stable IDs" for derived requirements/constraints/ideas so that re-running the
 * tool on the same inputs yields identical IDs (reproducibility is a hard
 * requirement). We derive IDs from a namespace + the content that defines the
 * entity, via SHA-256, then take a short base36 slug. No randomness, no counters
 * that depend on iteration order beyond the provided key material.
 */
import { createHash } from "node:crypto";

function slug(namespace: string, ...parts: string[]): string {
  const h = createHash("sha256").update(namespace + "\u0000" + parts.join("\u0000")).digest("hex");
  // 8 hex chars → base36-ish short, still collision-safe for fixture scale.
  return parseInt(h.slice(0, 10), 16).toString(36).slice(0, 7).padStart(7, "0");
}

export const stableId = {
  requirement: (challengeId: string, title: string, locator: string) =>
    `REQ_${slug("requirement", challengeId, title, locator)}`,
  constraint: (challengeId: string, requirementId: string, text: string) =>
    `CONSTR_${slug("constraint", challengeId, requirementId, text)}`,
  idea: (challengeId: string, submissionId: string, title: string, index: number) =>
    `IDEA_${slug("idea", challengeId, submissionId, title, String(index))}`,
  evidence: (...keys: string[]) => `EV_${slug("evidence", ...keys)}`,
  decision: (challengeId: string, kind: string, key: string) =>
    `DEC_${slug("decision", challengeId, kind, key)}`,
  conflict: (challengeId: string, type: string, key: string) =>
    `CONF_${slug("conflict", challengeId, type, key)}`,
  option: (decisionKey: string, sourceId: string) => `OPT_${slug("option", decisionKey, sourceId)}`,
};
