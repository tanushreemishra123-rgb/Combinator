# Workspace artifact schemas

All shapes are defined in [`src/types.ts`](../src/types.ts). Summary below.

## review-context-status.json
`{ challengeId, status: "supplied"|"absent", mode: "provided_with_spec_reconciliation"|"specification_derived", detail }`

## active-review-context.json
`{ challengeId, mode, recordId|null, status|null, requirements: Requirement[] }`
where `Requirement = { id, title, priority, constraints: {id,text,specificationDerived?}[], specificationDerived?, sourceLocation? }`.

## review-context-reconciliation.json
`{ challengeId, mode, missingInContext[], missingInSpecification[], conflicts:{id,field,contextValue,specificationValue}[], stale[], notes[] }`

## source-location-map.json
`{ [id]: SourceLocation }` where `SourceLocation = { kind, submissionId?, ideaId?, path?, startLine?, endLine?, locator?, excerpt? }`. `kind ∈ file|function|test|readme_section|page|slide|table|figure|speaker_note|reviewer_comment|scorecard|verification|specification`.

## submissions/<SUB>/profile.json (code)
`CodeSubmissionProfile` — applications[], architecture, build, tests, requirementCoverage[{requirementId,state,score,evidence,notes}], strengths[], weaknesses[], reviewEvidence[], compatibilityRisk, baseSuitability{score,reasoning}.

## submissions/<SUB>/ideas.json (ideation)
`IdeaProfile[]` — ideaId, title, problem/proposedAgents/sdlcPhases/workflow/data/integrations/humanOversight/security/…, evaluation{originality|feasibility|scalability|impact_potential|alignment_with_scope → {state,reasoning,evidence}}, evidence[].

## requirement-matrix.json
`{ challengeId, mode, rows: MatrixRow[], conflicts: Conflict[] }`
`MatrixRow = { requirementId, requirementTitle, cells:{sourceId,state,score,evidence,confidence,compatibilityRisk}[], recommendedSource, reasoning, confidence, unresolvedConflicts }`.
`Conflict.type ∈ human_vs_ai | review_vs_source | uncertain_evidence | contradiction`.

## decisions.json
`{ challengeId, mode, decisions: Decision[] }`
`Decision = { id, kind, title, requirementId?, options:{id,sourceId,label,evidence,compatibilityRisk}[], recommendation, reasoning, risk, state, selectedSource, copilotComment, regenerationRequired, updatedAt }`.
`state ∈ pending|accepted|rejected|alternative_selected|blocked|manual_review|unresolved`.

## provenance.json
`{ challengeId, mode, entries: {target, sourceId, sourcePath?, decisionId, evidence, generated, note?}[] }`. `generated:true` marks agent-generated bridging/assumptions.

## contradictions.json
`{ challengeId, mode, contradictions: Conflict[] }`

## verification.json
`{ challengeId, mode, candidate, overall: passed|failed|partial|not_verifiable, steps:{name,command?,state,detail,durationMs?}[], honestSummary, sourceIntegrityOk }`.

## integrity/integrity-report.json
`{ challengeId, before: HashRecord[], after: HashRecord[], mismatches:{path,before,after}[], critical }`. `HashRecord = {path,sha256,bytes}`.

## usage-report.json
`{ provider, model, calls, inputTokens, outputTokens, retries, failures, approxCostUsd, processingMs }`

## workspace-manifest.json
`{ challengeId, title, mode, generatedAt, combinatorVersion, reviewContextMode, artifacts[], usage, integrityCritical, verificationOverall }`

All outputs are human-readable, machine-readable, reproducible (deterministic in mock
mode), and consumable by another AI assistant.
