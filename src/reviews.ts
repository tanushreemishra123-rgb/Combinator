/**
 * Review / scorecard loader. Reads reviews/<SUB>/final-result.json and produces
 * review evidence WITHOUT fabricating missing detail. The starter pack ships
 * normalized AI review stubs (a score + an instruction not to fabricate), so we
 * surface exactly what is present and flag the rest as not_verifiable.
 *
 * It also classifies the origin (AI vs human) when the record states it, enabling
 * human-vs-AI conflict detection downstream.
 */
import { join } from "node:path";
import type { SafeFs } from "./fs-safe.js";
import type { DiscoveredChallenge } from "./ingest.js";
import { stableId } from "./ids.js";
import type { Evidence } from "./types.js";

export interface SubmissionReview {
  submissionId: string;
  finalScore: number | null;
  origin: "review_ai" | "review_human" | "scorecard" | "derived";
  evidence: Evidence[];
  note: string;
}

export function loadReviews(fs: SafeFs, ch: DiscoveredChallenge): Map<string, SubmissionReview> {
  const out = new Map<string, SubmissionReview>();
  if (!ch.reviewsDir) return out;
  for (const sub of ch.submissions) {
    const file = join(ch.reviewsDir, sub.submissionId, "final-result.json");
    if (!fs.exists(file)) {
      out.set(sub.submissionId, {
        submissionId: sub.submissionId,
        finalScore: null,
        origin: "derived",
        evidence: [],
        note: "No review record present.",
      });
      continue;
    }
    let rec: any = {};
    try {
      rec = JSON.parse(fs.readText(file));
    } catch {
      /* ignore */
    }
    const status: string = (rec.evidenceStatus ?? "").toString();
    const origin: SubmissionReview["origin"] = /ai/i.test(status)
      ? "review_ai"
      : /human/i.test(status)
        ? "review_human"
        : "scorecard";
    const score = typeof rec.finalScore === "number" ? rec.finalScore : null;
    const evidence: Evidence[] = [];
    if (score !== null) {
      evidence.push({
        id: stableId.evidence("review", sub.submissionId, String(score)),
        statement: `Normalized review final score: ${score}${status ? ` (${status})` : ""}.`,
        locations: [
          { kind: "reviewer_comment", submissionId: sub.submissionId, path: file, excerpt: `finalScore=${score}` },
        ],
        origin,
        confidence: "medium",
      });
    }
    out.set(sub.submissionId, {
      submissionId: sub.submissionId,
      finalScore: score,
      origin,
      evidence,
      note:
        rec.instruction ??
        (score === null ? "Review record present but without a usable score." : "Normalized review score only; detailed comments not provided."),
    });
  }
  return out;
}
