/**
 * Evidence-reference validation.
 *
 * Profiles may only make grounded claims when their source locators resolve to a
 * real input artifact. This validator is deliberately deterministic and does
 * not repair bad evidence: unresolved references remain visible for Copilot
 * review in evidence-validation.json.
 */
import { isAbsolute, join } from "node:path";
import type { SafeFs } from "./fs-safe.js";
import type { DiscoveredChallenge } from "./ingest.js";
import type { CodeSubmissionProfile, Evidence, IdeaProfile, SourceLocation } from "./types.js";

export interface EvidenceValidationFinding {
  evidenceId: string;
  statement: string;
  location: SourceLocation;
  state: "valid" | "unresolved" | "locator_only";
  detail: string;
}

function checkLocation(fs: SafeFs, challenge: DiscoveredChallenge, evidence: Evidence, location: SourceLocation): EvidenceValidationFinding {
  if (!location.path) {
    return {
      evidenceId: evidence.id,
      statement: evidence.statement,
      location,
      state: "locator_only",
      detail: "Non-file document locator retained; file existence cannot be checked from this record.",
    };
  }
  const path = isAbsolute(location.path) ? location.path : join(challenge.packageRoot, location.path);
  return {
    evidenceId: evidence.id,
    statement: evidence.statement,
    location,
    state: fs.exists(path) ? "valid" : "unresolved",
    detail: fs.exists(path) ? "Referenced source location exists." : "Referenced source location does not exist in the discovered package.",
  };
}

function findingsForEvidence(fs: SafeFs, challenge: DiscoveredChallenge, evidence: Evidence[]): EvidenceValidationFinding[] {
  return evidence.flatMap((e) => e.locations.map((location) => checkLocation(fs, challenge, e, location)));
}

export function validateProfileEvidence(
  fs: SafeFs,
  challenge: DiscoveredChallenge,
  codeProfiles: CodeSubmissionProfile[],
  ideaProfiles: IdeaProfile[],
): { challengeId: string; total: number; valid: number; unresolved: number; locatorOnly: number; findings: EvidenceValidationFinding[] } {
  const evidence: Evidence[] = [];
  for (const profile of codeProfiles) {
    evidence.push(...profile.architecture.evidence, ...profile.build.evidence, ...profile.tests.evidence, ...profile.reviewEvidence);
    for (const coverage of profile.requirementCoverage) evidence.push(...coverage.evidence);
  }
  for (const idea of ideaProfiles) {
    evidence.push(...idea.evidence);
    for (const value of Object.values(idea.evaluation)) evidence.push(...value.evidence);
  }
  const findings = findingsForEvidence(fs, challenge, evidence);
  return {
    challengeId: challenge.challengeId,
    total: findings.length,
    valid: findings.filter((f) => f.state === "valid").length,
    unresolved: findings.filter((f) => f.state === "unresolved").length,
    locatorOnly: findings.filter((f) => f.state === "locator_only").length,
    findings,
  };
}
