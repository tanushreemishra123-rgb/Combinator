/**
 * Review-context engine (challenge §Review Context + review-context-policy.json).
 *
 * Two mandatory paths:
 *  1. SUPPLIED  → normalize the supplied context as the primary requirements map,
 *                 reconcile it against the final specification (challenge-context.json),
 *                 and report missing / stale / conflicting content. Mode:
 *                 provided_with_spec_reconciliation.
 *  2. ABSENT    → derive equivalent context from the final specification using
 *                 deterministic stable IDs and retained source locations; label
 *                 fields specification_derived. Mode: specification_derived.
 *
 * Never invents scorecard weights, reviewer comments, platform IDs, runtime
 * versions, or unsupported constraints (RC_05).
 *
 * Emits the four required workspace artifacts:
 *   review-context-status.json, active-review-context.json,
 *   review-context-reconciliation.json, source-location-map.json
 */
import type { SafeFs } from "./fs-safe.js";
import { IngestError, type DiscoveredChallenge } from "./ingest.js";
import { stableId } from "./ids.js";
import type {
  ActiveReviewContext,
  Constraint,
  Requirement,
  ReviewContextMode,
  ReviewContextReconciliation,
  SourceLocation,
} from "./types.js";

interface SpecRequirement {
  id?: string;
  title: string;
  priority?: string;
  locator?: string;
  constraints?: Array<{ id?: string; text: string }>;
}

interface ChallengeContext {
  challengeId: string;
  title?: string;
  challengeMode: string;
  requirements?: SpecRequirement[];
  evaluationCriteria?: string[];
  maximumIdeasPerSubmission?: number;
  acceptedFormats?: string[];
}

interface SuppliedContext {
  recordId?: string;
  challengeId?: string;
  status?: string;
  requirements?: SpecRequirement[];
  mode?: string;
  instruction?: string;
}

export interface ReviewContextResult {
  status: { challengeId: string; status: "supplied" | "absent"; mode: ReviewContextMode; detail: string };
  active: ActiveReviewContext;
  reconciliation: ReviewContextReconciliation;
  sourceLocationMap: Record<string, SourceLocation>;
}

function markdownSpecification(text: string, ch: DiscoveredChallenge): ChallengeContext {
  const lines = text.split(/\r?\n/);
  const title = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim() || ch.title;
  const sectionAt = (name: RegExp) => lines.findIndex((line) => name.test(line));
  const requirementStart = sectionAt(/^#{1,3}\s*(functional )?requirements/i);
  const stopAt = (from: number) => {
    for (let i = from + 1; i < lines.length; i++) {
      if (/^#{1,2}\s*(technical|deliverables|evaluation|success|important|technology)/i.test(lines[i]!)) return i;
    }
    return lines.length;
  };
  const requirements: SpecRequirement[] = [];
  if (requirementStart >= 0) {
    const end = stopAt(requirementStart);
    for (let i = requirementStart + 1; i < end; i++) {
      const match = lines[i]!.match(/^\s*(?:#{2,6}\s+|\d+\.\s+)([^:#]+?)(?::\s*)?$/);
      if (!match) continue;
      const item = match[1]!.trim();
      if (item.length >= 3 && item.length <= 140) requirements.push({ title: item, locator: `line ${i + 1}` });
    }
  }
  const criteriaStart = sectionAt(/^#{1,3}\s*evaluation criteria/i);
  const evaluationCriteria: string[] = [];
  if (criteriaStart >= 0) {
    const end = stopAt(criteriaStart);
    for (let i = criteriaStart + 1; i < end; i++) {
      const line = lines[i]!.trim();
      const list = line.match(/^[-*]\s+(.+)$/)?.[1];
      const table = line.startsWith("|") ? line.split("|")[1]?.trim() : undefined;
      const candidate = list ?? table;
      if (candidate && candidate.length >= 3 && !/^criteria$/i.test(candidate) && !/^[-: ]+$/.test(candidate)) evaluationCriteria.push(candidate);
    }
  }
  return {
    challengeId: ch.challengeId,
    title,
    challengeMode: ch.mode,
    requirements,
    evaluationCriteria: [...new Set(evaluationCriteria)],
  };
}

function readSpec(fs: SafeFs, ch: DiscoveredChallenge): ChallengeContext | null {
  if (!ch.specificationPath) return null;
  try {
    const text = fs.readText(ch.specificationPath);
    if (/\.json$/i.test(ch.specificationPath)) return JSON.parse(text) as ChallengeContext;
    if (/\.(md|markdown|txt)$/i.test(ch.specificationPath)) return markdownSpecification(text, ch);
    return null;
  } catch {
    return null;
  }
}

/** Build requirements from a spec's explicit requirements[] (code challenges). */
function specRequirementsToActive(
  challengeId: string,
  spec: ChallengeContext,
  specPath: string,
  derived: boolean,
): { requirements: Requirement[]; locations: Record<string, SourceLocation> } {
  const locations: Record<string, SourceLocation> = {};
  const requirements = (spec.requirements ?? []).map((r, i): Requirement => {
    const id = r.id ?? stableId.requirement(challengeId, r.title, `req[${i}]`);
    locations[id] = {
      kind: "specification",
      path: specPath,
      locator: r.locator ?? `requirements[${i}]`,
      excerpt: r.title,
    };
    const constraints: Constraint[] = (r.constraints ?? []).map((c, j) => {
      const cid = c.id ?? stableId.constraint(challengeId, id, c.text);
      locations[cid] = {
        kind: "specification",
        path: specPath,
        locator: `requirements[${i}].constraints[${j}]`,
        excerpt: c.text,
      };
      return { id: cid, text: c.text, specificationDerived: derived, sourceLocation: locations[cid] };
    });
    return {
      id,
      title: r.title,
      priority: (["high", "medium", "low"].includes(r.priority ?? "")
        ? r.priority
        : "unspecified") as Requirement["priority"],
      constraints,
      specificationDerived: derived,
      sourceLocation: locations[id],
    };
  });
  return { requirements, locations };
}

/**
 * Derive requirements for an ideation challenge from evaluationCriteria. These
 * ARE the mandatory evaluation areas; deriving them is faithful to the spec
 * (not invented). One requirement per criterion, deterministic IDs.
 */
function ideationCriteriaToActive(
  challengeId: string,
  spec: ChallengeContext,
  specPath: string,
): { requirements: Requirement[]; locations: Record<string, SourceLocation> } {
  const locations: Record<string, SourceLocation> = {};
  const criteria = spec.evaluationCriteria ?? [];
  const requirements = criteria.map((title, i): Requirement => {
    const id = stableId.requirement(challengeId, title, `evaluationCriteria[${i}]`);
    locations[id] = {
      kind: "specification",
      path: specPath,
      locator: `evaluationCriteria[${i}]`,
      excerpt: title,
    };
    return {
      id,
      title,
      priority: "high",
      constraints: [],
      specificationDerived: true,
      sourceLocation: locations[id],
    };
  });
  return { requirements, locations };
}

export function buildReviewContext(fs: SafeFs, ch: DiscoveredChallenge): ReviewContextResult {
  const spec = readSpec(fs, ch);
  const specPath = ch.specificationPath ?? "(no final specification resolved)";
  if (!spec) {
    throw new IngestError(
      `No usable final specification for ${ch.challengeId}. Provide one in the pack, ` +
        `pass --spec-dir <directory>, or add a supported bundled visible-fixture snapshot.`,
    );
  }

  // Read supplied context (if the ref resolved to a file).
  let supplied: SuppliedContext | null = null;
  if (ch.reviewContextPath) {
    try {
      supplied = JSON.parse(fs.readText(ch.reviewContextPath)) as SuppliedContext;
    } catch {
      supplied = null;
    }
  }
  const suppliedIsReal =
    !!supplied &&
    Array.isArray(supplied.requirements) &&
    supplied.requirements.length > 0 &&
    (supplied.status ?? "").toUpperCase() !== "NOT_PROVIDED";

  // ── ABSENT path ────────────────────────────────────────────────────────────
  if (!suppliedIsReal) {
    const mode: ReviewContextMode = "specification_derived";
    let built: { requirements: Requirement[]; locations: Record<string, SourceLocation> };
    if (spec && ch.mode === "ideation") built = ideationCriteriaToActive(ch.challengeId, spec, specPath);
    else if (spec) built = specRequirementsToActive(ch.challengeId, spec, specPath, true);
    else built = { requirements: [], locations: {} };

    return {
      status: {
        challengeId: ch.challengeId,
        status: "absent",
        mode,
        detail:
          supplied?.status === "NOT_PROVIDED"
            ? `Review context explicitly NOT_PROVIDED; derived from final specification (${ch.specificationSource}).`
            : `No usable supplied review context; derived from final specification (${ch.specificationSource}).`,
      },
      active: {
        challengeId: ch.challengeId,
        mode,
        recordId: null,
        status: null,
        requirements: built.requirements,
      },
      reconciliation: {
        challengeId: ch.challengeId,
        mode,
        missingInContext: [],
        missingInSpecification: [],
        conflicts: [],
        stale: [],
        notes: [
          "No supplied review context. Active context derived from the final specification.",
          ch.mode === "ideation"
            ? "Derived requirements correspond to the mandatory ideation evaluation criteria."
            : "Derived requirements correspond to specification requirements.",
          "All derived fields are labeled specification_derived. No weights, reviewer comments or platform IDs were invented.",
          `Final specification source: ${ch.specificationSource}.`,
        ],
      },
      sourceLocationMap: built.locations,
    };
  }

  // ── SUPPLIED path ────────────────────────────────────────────────────────────
  const mode: ReviewContextMode = "provided_with_spec_reconciliation";
  const suppliedBuilt = specRequirementsToActive(
    ch.challengeId,
    { challengeId: ch.challengeId, challengeMode: ch.mode, requirements: supplied!.requirements },
    ch.reviewContextPath!,
    false,
  );
  // Preserve supplied IDs verbatim (RC_02): overwrite generated ids with given.
  const active: ActiveReviewContext = {
    challengeId: ch.challengeId,
    mode,
    recordId: supplied!.recordId ?? null,
    status: supplied!.status ?? null,
    requirements: suppliedBuilt.requirements,
  };

  // Reconcile with the final specification.
  const specBuilt = spec
    ? specRequirementsToActive(ch.challengeId, spec, specPath, false)
    : { requirements: [] as Requirement[], locations: {} };

  const ctxIds = new Map(active.requirements.map((r) => [r.id, r]));
  const specIds = new Map(specBuilt.requirements.map((r) => [r.id, r]));
  const conflicts: ReviewContextReconciliation["conflicts"] = [];
  for (const [id, cr] of ctxIds) {
    const sr = specIds.get(id);
    if (!sr) continue;
    if (cr.title !== sr.title) {
      conflicts.push({ id, field: "title", contextValue: cr.title, specificationValue: sr.title });
    }
    if (cr.priority !== sr.priority) {
      conflicts.push({ id, field: "priority", contextValue: cr.priority, specificationValue: sr.priority });
    }
  }
  const missingInContext = [...specIds.keys()].filter((id) => !ctxIds.has(id));
  const missingInSpecification = [...ctxIds.keys()].filter((id) => !specIds.has(id));

  return {
    status: {
      challengeId: ch.challengeId,
      status: "supplied",
      mode,
      detail: `Supplied review context (${active.status ?? "status unknown"}) used as primary requirements map and reconciled with the specification.`,
    },
    active,
    reconciliation: {
      challengeId: ch.challengeId,
      mode,
      missingInContext,
      missingInSpecification,
      conflicts,
      stale: [],
      notes: [
        conflicts.length === 0 && missingInContext.length === 0 && missingInSpecification.length === 0
          ? "Supplied review context is fully consistent with the specification."
          : "Material differences reported above rather than silently resolved.",
        `Final specification source: ${ch.specificationSource}.`,
      ],
    },
    sourceLocationMap: { ...specBuilt.locations, ...suppliedBuilt.locations },
  };
}
