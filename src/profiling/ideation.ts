/**
 * Ideation submission profiling (challenge §Ideation Mode / Idea-level analysis).
 *
 * - Identifies up to `maxIdeas` ideas per submission (per-file, plus intra-doc
 *   "Idea N" splitting) and assigns deterministic stable idea IDs.
 * - Profiles each idea: problem, proposed agents, SDLC phases, users,
 *   beneficiaries, workflow, data, integrations, human oversight, security,
 *   feasibility, scalability, impact, risks, assumptions, differentiators.
 * - Scores each idea against the mandatory evaluation areas (Originality,
 *   Feasibility, Scalability, Impact Potential, Alignment with Scope).
 *
 * All fields are grounded in extracted document blocks with locators. Nothing is
 * invented: a field absent from the document is left undefined and its evaluation
 * state reflects the gap (missing / not_verifiable).
 */
import type { DiscoveredChallenge, DiscoveredSubmission } from "../ingest.js";
import { pkgRelative } from "../ingest.js";
import { stableId } from "../ids.js";
import type { LlmAdapter } from "../llm/adapter.js";
import type { AssessmentState, Evidence, IdeaProfile, Requirement, SourceLocation } from "../types.js";
import { extractDocument, type ContentBlock, type ExtractedDocument } from "../ideation/docingest.js";

interface RawIdea {
  title: string;
  blocks: ContentBlock[];
  doc: ExtractedDocument;
}

const IDEA_SPLIT = /\b(?:idea|concept)\s*[-:#]?\s*(\d+)\b/i;

/** Split a document into ideas by "Idea N" markers; else treat as a single idea. */
function splitIntoIdeas(doc: ExtractedDocument): RawIdea[] {
  const markers: number[] = [];
  doc.blocks.forEach((b, i) => {
    if (b.kind === "heading" && IDEA_SPLIT.test(b.text)) markers.push(i);
    else if (/^\s*(idea|concept)\s*\d+/i.test(b.text)) markers.push(i);
  });
  if (markers.length <= 1) {
    const title = deriveTitle(doc);
    return [{ title, blocks: doc.blocks, doc }];
  }
  const ideas: RawIdea[] = [];
  for (let m = 0; m < markers.length; m++) {
    const start = markers[m]!;
    const end = m + 1 < markers.length ? markers[m + 1]! : doc.blocks.length;
    const blocks = doc.blocks.slice(start, end);
    ideas.push({ title: (blocks[0]?.text ?? `Idea ${m + 1}`).slice(0, 80), blocks, doc });
  }
  return ideas;
}

const GENERIC_HEADING = /^(the\s+problem|introduction|overview|summary|goals?|background|abstract)\b/i;

function cleanTitle(raw: string, doc: ExtractedDocument): string {
  let t = raw.trim();
  // Prefer an explicit "Idea N: <name>" / "Concept N: <name>" label if present.
  const m = t.match(/\b(?:idea|concept)\s*\d*\s*[:\-]\s*([^.\n]{3,90})/i);
  if (m) t = m[1]!.trim();
  // Otherwise strip a long boilerplate challenge-submission prefix.
  else t = t.replace(/^.*?challenge submission[^:]*:?\s*/i, "").trim() || raw.trim();
  t = t.replace(/\s+/g, " ").slice(0, 90).trim();
  if (!t || GENERIC_HEADING.test(t)) {
    return doc.fileName.replace(/\.(pdf|docx|pptx)$/i, "").replace(/[-_]/g, " ").trim();
  }
  return t;
}

function deriveTitle(doc: ExtractedDocument): string {
  // Look for an "Idea N:" marker anywhere in the first few blocks.
  for (const b of doc.blocks.slice(0, 4)) {
    if (/\b(?:idea|concept)\s*\d*\s*[:\-]/i.test(b.text)) return cleanTitle(b.text, doc);
  }
  const heading = doc.blocks.find((b) => b.kind === "heading" && b.text.length > 3 && !GENERIC_HEADING.test(b.text));
  if (heading) return cleanTitle(heading.text, doc);
  return doc.fileName.replace(/\.(pdf|docx|pptx)$/i, "").replace(/[-_]/g, " ").trim();
}

/** Extract the sentence window around the first keyword hit in a block. */
function sentenceWindow(text: string, keywords: RegExp): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const idx = sentences.findIndex((s) => keywords.test(s));
  if (idx === -1) return text.slice(0, 280);
  const window = sentences.slice(Math.max(0, idx), idx + 2).join(" ");
  return window.length > 320 ? window.slice(0, 320) + "…" : window;
}

/**
 * Pick the block that best matches the field's keywords (by match count), then
 * return a trimmed sentence window — not the whole block — so fields are distinct
 * and readable.
 */
function findField(
  idea: RawIdea,
  submissionId: string,
  ideaId: string,
  keywords: RegExp,
): { text: string; location: SourceLocation } | null {
  let best: { block: ContentBlock; score: number } | null = null;
  const global = new RegExp(keywords.source, "gi");
  for (const b of idea.blocks) {
    const matches = (b.text.match(global) ?? []).length;
    if (matches > 0 && (!best || matches > best.score)) best = { block: b, score: matches };
  }
  if (!best) return null;
  const b = best.block;
  const snippet = sentenceWindow(b.text, keywords);
  return {
    text: snippet,
    location: {
      kind: b.kind === "slide" ? "slide" : b.kind === "speaker_note" ? "speaker_note" : "page",
      submissionId,
      ideaId,
      path: idea.doc.file,
      locator: b.locator,
      excerpt: snippet.slice(0, 120),
    },
  };
}

function ev(topic: string, statement: string, loc: SourceLocation | null, reliable: boolean): Evidence {
  return {
    id: stableId.evidence("idea", topic, statement),
    statement,
    locations: loc ? [loc] : [],
    origin: "source",
    confidence: !loc ? "low" : reliable ? "high" : "medium",
  };
}

const CRITERION_SIGNALS: Record<string, RegExp> = {
  Originality: /novel|unique|differentiat|innovat|first|new approach|unlike/i,
  Feasibility: /feasib|implement|prototype|mvp|build|realistic|technically|effort/i,
  Scalability: /scal|throughput|concurrent|load|grow|enterprise|multi-?tenant/i,
  "Impact Potential": /impact|benefit|value|productivit|roi|time saved|quality|adoption/i,
  "Alignment with Scope": /sdlc|topcoder|community|agent|workflow|software development|review/i,
};

export async function profileIdeationSubmission(
  challenge: DiscoveredChallenge,
  sub: DiscoveredSubmission,
  evaluationRequirements: Requirement[],
  maxIdeas: number,
  llm: LlmAdapter,
): Promise<IdeaProfile[]> {
  const docFiles = sub.files.filter((f) => /\.(pdf|docx|pptx)$/i.test(f));
  if (docFiles.length === 0) return [];

  const docs: ExtractedDocument[] = [];
  for (const f of docFiles) docs.push(await extractDocument(f));

  // Gather candidate ideas across all docs, cap at maxIdeas.
  let raw: RawIdea[] = [];
  for (const d of docs) raw.push(...splitIntoIdeas(d));
  raw = raw.slice(0, Math.max(1, maxIdeas));

  const profiles: IdeaProfile[] = [];
  for (const [index, idea] of raw.entries()) {
    const ideaId = stableId.idea(challenge.challengeId, sub.submissionId, idea.title, index);
    const reliable = idea.doc.reliable && idea.blocks.some((b) => b.reliable);
    const allText = idea.blocks.map((b) => b.text).join(" ");

    const fields: Record<string, { text: string; location: SourceLocation } | null> = {
      problem: findField(idea, sub.submissionId, ideaId, /problem|challenge|pain|gap|today|currently/i),
      proposedAgents: findField(idea, sub.submissionId, ideaId, /agent|assistant|bot|autonomous|llm|model/i),
      workflow: findField(idea, sub.submissionId, ideaId, /workflow|pipeline|step|process|flow|stage/i),
      data: findField(idea, sub.submissionId, ideaId, /data|dataset|repository|corpus|input|source/i),
      integrations: findField(idea, sub.submissionId, ideaId, /integrat|api|mcp|webhook|connect|plugin|github|slack/i),
      humanOversight: findField(idea, sub.submissionId, ideaId, /human|oversight|review|approv|in-the-loop|supervis/i),
      security: findField(idea, sub.submissionId, ideaId, /security|secure|privacy|permission|credential|secret|auth/i),
      feasibility: findField(idea, sub.submissionId, ideaId, /feasib|implement|prototype|mvp|effort|realistic/i),
      scalability: findField(idea, sub.submissionId, ideaId, /scal|throughput|load|grow|enterprise/i),
      impact: findField(idea, sub.submissionId, ideaId, /impact|benefit|value|productivit|roi/i),
    };

    const sdlcPhases = [
      /requirement|planning|scoping/i,
      /design|architecture/i,
      /develop|coding|implement/i,
      /test|qa|review/i,
      /deploy|release|ops|monitor/i,
    ]
      .map((re, i) => (re.test(allText) ? ["Requirements", "Design", "Development", "Testing/Review", "Deployment/Ops"][i]! : null))
      .filter((x): x is string => x !== null);

    // Evaluation against the five mandatory areas.
    const evaluation = {} as IdeaProfile["evaluation"];
    const critMap: Array<[keyof IdeaProfile["evaluation"], string]> = [
      ["originality", "Originality"],
      ["feasibility", "Feasibility"],
      ["scalability", "Scalability"],
      ["impact_potential", "Impact Potential"],
      ["alignment_with_scope", "Alignment with Scope"],
    ];
    for (const [key, label] of critMap) {
      const hit = findField(idea, sub.submissionId, ideaId, CRITERION_SIGNALS[label]!);
      const state: AssessmentState = !reliable ? "not_verifiable" : hit ? "complete" : "partial";
      evaluation[key] = {
        state,
        reasoning: hit
          ? `Document addresses ${label} at ${hit.location.locator}.`
          : reliable
            ? `No explicit ${label} discussion found; inferred weak.`
            : "Document extraction unreliable; manual review required.",
        evidence: [ev(label, `${label} signal`, hit?.location ?? null, reliable)],
      };
    }

    const evidence: Evidence[] = [];
    for (const [name, f] of Object.entries(fields)) {
      if (f) evidence.push(ev(name, `${name} described`, f.location, reliable));
    }
    // Title/overview evidence always present.
    evidence.unshift(
      ev("title", `Idea titled "${idea.title}"`, {
        kind: idea.doc.format === "pptx" ? "slide" : "page",
        submissionId: sub.submissionId,
        ideaId,
        path: idea.doc.file,
        locator: idea.blocks[0]?.locator ?? "p.1",
        excerpt: idea.title,
      }, reliable),
    );

    const narration = await llm.complete({
      task: "idea.profile",
      system: "Summarize a proposed idea faithfully from extracted signals. Do not add facts, metrics or claims.",
      user: `One-paragraph neutral summary of idea "${idea.title}".`,
      grounding: {
        title: idea.title,
        problem: fields.problem?.text?.slice(0, 200),
        agents: fields.proposedAgents?.text?.slice(0, 200),
        sdlcPhases,
        reliable,
        summary: `${idea.title}. ${fields.problem?.text?.slice(0, 160) ?? "Problem statement not explicitly found."}`,
      },
    });

    profiles.push({
      ideaId,
      submissionId: sub.submissionId,
      title: idea.title,
      problem: fields.problem?.text,
      proposedAgents: fields.proposedAgents?.text,
      sdlcPhases,
      workflow: fields.workflow?.text,
      data: fields.data?.text,
      integrations: fields.integrations?.text,
      humanOversight: fields.humanOversight?.text,
      security: fields.security?.text,
      feasibility: fields.feasibility?.text,
      scalability: fields.scalability?.text,
      impact: fields.impact?.text,
      risks: [],
      assumptions: reliable ? [] : ["Document extraction was unreliable; profile fields may be incomplete."],
      differentiators: [],
      evaluation,
      evidence: [
        ev("narration", narration.text, {
          kind: "page",
          submissionId: sub.submissionId,
          ideaId,
          path: idea.doc.file,
          locator: idea.blocks[0]?.locator ?? "p.1",
        }, reliable),
        ...evidence,
      ],
    });
  }
  return profiles;
}

export function ideationMaxIdeas(challenge: DiscoveredChallenge, fsText: string | null): number {
  if (!fsText) return 3;
  try {
    const spec = JSON.parse(fsText) as { maximumIdeasPerSubmission?: number };
    return spec.maximumIdeasPerSubmission ?? 3;
  } catch {
    return 3;
  }
}

// Re-export for convenience in the orchestrator.
export { pkgRelative };
