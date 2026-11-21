/**
 * Pipeline tests: review-context derivation, matrix/transplant logic on synthetic
 * profiles, and ideation contradiction detection. These assert behavior without
 * depending on heavy real submissions.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCodeMatrix } from "../src/evidence.js";
import { buildCodeDecisions } from "../src/decisions.js";
import { detectContradictions } from "../src/ideation/synthesize.js";
import type { CodeSubmissionProfile, IdeaProfile, Requirement } from "../src/types.js";

function req(id: string, title: string): Requirement {
  return { id, title, priority: "high", constraints: [] };
}

function codeProfile(id: string, coverage: Record<string, number>, suitability: number): CodeSubmissionProfile {
  return {
    submissionId: id,
    kind: "code",
    rootPath: `/x/${id}`,
    applications: [{ path: "app", stack: ["TypeScript"], role: "backend" }],
    architecture: { summary: "", evidence: [] },
    build: { state: "complete", commands: ["npm run build"], evidence: [] },
    tests: { state: "complete", frameworks: ["Vitest"], evidence: [] },
    requirementCoverage: Object.entries(coverage).map(([requirementId, score]) => ({
      requirementId,
      state: score >= 10 ? "complete" : score > 0 ? "partial" : "missing",
      score,
      evidence: [],
    })),
    strengths: [],
    weaknesses: [],
    reviewEvidence: [],
    compatibilityRisk: "low",
    baseSuitability: { score: suitability, reasoning: "" },
  };
}

test("transplant fires only where a non-base source wins by a clear margin", () => {
  const reqs = [req("R1", "One"), req("R2", "Two"), req("R3", "Three")];
  // SUB_A strong on R1/R2, SUB_B far stronger on R3.
  const a = codeProfile("SUB_A", { R1: 15, R2: 14, R3: 4 }, 80);
  const b = codeProfile("SUB_B", { R1: 13, R2: 12, R3: 16 }, 70);
  const matrix = buildCodeMatrix("CH", reqs, [a, b], new Map());
  const dw = buildCodeDecisions("CH", matrix, [a, b]);
  const base = dw.decisions.find((d) => d.kind === "base_selection")!;
  const transplants = dw.decisions.filter((d) => d.kind === "transplant");
  // SUB_A wins 2 of 3 requirements → base = SUB_A.
  assert.ok(base.options[0]!.sourceId === "SUB_A");
  // Only R3 should be a transplant (margin 16 vs 4).
  assert.equal(transplants.length, 1);
  assert.equal(transplants[0]!.requirementId, "R3");
});

test("no transplant when base already covers a requirement adequately (small margin)", () => {
  const reqs = [req("R1", "One"), req("R2", "Two")];
  const a = codeProfile("SUB_A", { R1: 15, R2: 14 }, 80);
  const b = codeProfile("SUB_B", { R1: 16, R2: 13 }, 70); // wins R1 by only 1
  const matrix = buildCodeMatrix("CH", reqs, [a, b], new Map());
  const dw = buildCodeDecisions("CH", matrix, [a, b]);
  const transplants = dw.decisions.filter((d) => d.kind === "transplant");
  assert.equal(transplants.length, 0);
});

test("review-vs-source conflict surfaces when high score meets weak evidence", () => {
  const reqs = [req("R1", "One")];
  const a = codeProfile("SUB_A", { R1: 0 }, 50); // missing grounded evidence
  const reviews = new Map([
    ["SUB_A", { submissionId: "SUB_A", finalScore: 100, origin: "review_ai" as const, evidence: [], note: "" }],
  ]);
  const matrix = buildCodeMatrix("CH", reqs, [a], reviews);
  assert.ok(matrix.conflicts.some((c) => c.type === "review_vs_source"));
});

function idea(id: string, text: string): IdeaProfile {
  return {
    ideaId: id,
    submissionId: "S",
    title: id,
    problem: text,
    proposedAgents: text,
    workflow: text,
    humanOversight: text,
    security: text,
    integrations: text,
    sdlcPhases: [],
    risks: [],
    assumptions: [],
    differentiators: [],
    evaluation: {
      originality: { state: "partial", reasoning: "", evidence: [] },
      feasibility: { state: "partial", reasoning: "", evidence: [] },
      scalability: { state: "partial", reasoning: "", evidence: [] },
      impact_potential: { state: "partial", reasoning: "", evidence: [] },
      alignment_with_scope: { state: "partial", reasoning: "", evidence: [] },
    },
    evidence: [{ id: "e", statement: "", locations: [{ kind: "page", path: "f", locator: "p.1" }], origin: "source", confidence: "medium" }],
  };
}

test("contradiction detection exposes opposing positions", () => {
  const ideas = [
    idea("IDEA_1", "a fully autonomous end-to-end automation with no human needed"),
    idea("IDEA_2", "a human-in-the-loop design where human oversight and approval required"),
  ];
  const conflicts = detectContradictions("CH", ideas);
  assert.ok(conflicts.some((c) => c.type === "contradiction"));
});
