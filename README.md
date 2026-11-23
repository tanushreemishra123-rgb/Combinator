# Topcoder Combinator

An AI-assisted **Combinator** that compares selected submissions from one completed Topcoder challenge, recommends the strongest source for each requirement or concept component, lets a **Copilot** decide what to retain, and generates a derived
candidate with complete **evidence, provenance, and verification**.

- **Code mode** → a runnable combined solution using a *base-plus-transplants* strategy.
- **Ideation mode** → one coherent synthesized concept from approved idea components.

The agent **analyzes and proposes**; the Copilot **accepts, rejects, replaces, or blocks**. Original submissions are immutable inputs and are never modified.

> Design principle: the Combinator's **facts are computed deterministically** from 
> real file and document inspection (requirement coverage, base suitability,
> contradictions, integrity, verification). The LLM is a **narration layer only**,
> so the tool produces grounded output — and runs fully — in keyless **mock mode**,
> and never fabricates evidence.


## Demo video

demo video: https://www.loom.com/share/8a80e46e84004dd1acfc5b37a06a1b75


---

## Quick start

```bash
npm install
npm run build                      # type-check + compile (optional; tsx runs TS directly)

# 1. See what's in the pack
npm run combinator -- list --pack ./starter-pack

# 2. Generate the workspace for every fixture (mock mode — no API key needed)
npm run combinator -- run-all --pack ./starter-pack --out ./workspace

# 3. Open the Copilot review UI
npm run ui                         # http://localhost:4600
```

Everything above works offline with **zero configuration** (provider defaults to `mock`). Generated workspaces for all four fixtures are included under [`workspace/`](workspace/).

---

## The starter pack (external input — not bundled)

Per the challenge Copilot, the organizer's starter pack is an **external input** and is **not** committed to this repository. Download `TC_COMBINATOR_STARTER_PACK_new.zip`
and point `--pack` at **either** the `.zip` **or** its extracted root folder — the tool accepts both:

```bash
# A) extracted folder (extract preserving the included structure, then point at the root)
npm run combinator -- run-all --pack /path/to/topcoder-combinator-starter-pack --out ./workspace

# B) the zip directly (extracted internally into a disposable working directory)
npm run combinator -- run-all --pack /path/to/TC_COMBINATOR_STARTER_PACK_new.zip --out ./workspace
```

There are **no hard-coded absolute paths** anywhere — the pack location is always supplied via `--pack` (the UI uses `COMBINATOR_PACK`). Original submissions are treated as immutable: a submission delivered as a ZIP is extracted into an **isolated,
disposable** temp directory for analysis/build/test, and the original is never modified (verified by the SHA-256 before/after integrity report). The generated workspaces under [`workspace/`](workspace/) **are** committed — they are review deliverables.

See [`docs/REVIEW_CONTEXT_MAP.md`](docs/REVIEW_CONTEXT_MAP.md) for how each of the nine review contexts is satisfied, with source-file and artifact evidence.

---

## Commands

| Command | Purpose |
| --- | --- |
| `combinator list --pack <dir>` | List challenges discovered in the starter pack |
| `combinator run <CHALLENGE_ID> --pack <dir> [--out <dir>]` | Run one challenge end-to-end |
| `combinator run-all --pack <dir> [--out <dir>]` | Run every challenge in the manifest |
| `combinator decide <ID> --id <decisionId> --state <state> [--option <optId>] [--comment ".."]` | Apply a Copilot decision and regenerate |
| `npm run ui` | Launch the local review UI (reads/writes the workspace) |

Flags: `--verify-exec` runs the dynamic build/test steps (install/build/test);
`--exec-timeout <ms>` bounds each. Without it, dynamic steps are recorded as `skipped` (never `passed`).

### Final specification resolution

The final challenge specification is resolved in this fixed order: a specification inside the starter pack, a caller-supplied `--spec-dir <directory>` (or `COMBINATOR_SPEC_DIR`), then this repository's `specifications/` snapshot for the
four public fixtures. Specification files in an explicit directory are named `<CHALLENGE_ID>.json`, `.md`, or `.txt`. The run fails clearly if none is available;
`challenge-context.json` is never silently treated as the final specification.

For hidden/future packs, the supported package-level contract is:

```json
{
  "specification": {
    "path": "final-challenge-specification.md",
    "format": "markdown",
    "required": true
  }
}
```

`path` is relative to the folder containing `challenge-package.json`. Markdown is required and TXT is also accepted; specifications are read locally and never fetched from a public URL during evaluation.

```bash
npm run combinator -- run-all --pack /path/to/starter-pack --spec-dir /path/to/final-specifications --out ./workspace
```

Decision states: `pending · accepted · rejected · alternative_selected · blocked ·
manual_review · unresolved`.

---

## How it works (pipeline)

```
discover → hash(before) → review-context → load reviews → profile
        → requirement-matrix → decisions
        → (code: base + transplants + verify | ideation: synthesize + verify)
        → hash(after) + integrity → write workspace
```

See [`docs/architecture.svg`](docs/architecture.svg) (or the GitHub-rendered
[`docs/architecture.mmd`](docs/architecture.mmd)).

### Code mode — base plus transplants
1. **Base selection** — the submission that wins the most requirements by grounded coverage strength (overall base suitability breaks ties).
2. **Transplants** — only after the Copilot approves a *non-base* source that beats the base by a clear margin for a requirement. Donor grounding files are copied into `combined-solution/_transplants/<req>/<donor>/`, **namespaced so the base build is never silently broken**.
3. **Verification after each transplant** (with `--verify-exec`); a failed step rolls that transplant back and marks its decision `blocked`, preserving the last verified candidate. Free-form merging and cross-language porting are intentionally **not**
   attempted. The tool never claims success merely because files were copied.

### Ideation mode — synthesis
1. **Copilot approval gate** — pending ideas are excluded; a candidate concept is generated only from accepted or explicitly selected ideas.
2. **Document ingestion** of DOCX / PDF / PPTX with preserved locations (page/slide/section) and speaker notes; unreliable extraction is marked `not_verifiable`.
3. **Idea-level analysis** — up to 3 ideas per submission, each profiled and scored against the five evaluation areas (Originality, Feasibility, Scalability, Impact Potential, Alignment with Scope).
4. **Contradictions** across ideas are exposed as trade-offs, not silently merged.
5. **Synthesis** of one coherent concept from *accepted* ideas; bridging/assumption statements are explicitly labeled and no unsupported metrics are added.

---

## Review context — supplied *and* missing

Both paths are supported (see **Schemas** below):

- **Supplied** (the 3 code fixtures): used as the primary requirements map, IDs preserved, and **reconciled** against the final specification — differences are reported, not silently resolved. Mode `provided_with_spec_reconciliation`.
- **Absent** (the ideation fixture, `NOT_PROVIDED`): context is **derived** from the final specification with deterministic stable IDs; derived fields are labeled
  `specification_derived`. No weights, reviewer comments, or platform IDs are invented.

Each run emits `review-context-status.json`, `active-review-context.json`,`review-context-reconciliation.json`, and `source-location-map.json`.

---

## LLM provider & Amazon Bedrock

One documented adapter interface (`src/llm/adapter.ts`); provider-specific logic is isolated per file. Selected by configuration only — no code change needed to switch.

| Provider | Env | Notes |
| --- | --- | --- |
| `mock` *(default)* | — | Deterministic, offline, keyless. Use for organizer review. |
| `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` | Default live provider. |
| `bedrock` | `AWS_REGION`, `BEDROCK_MODEL_ID` (+ standard AWS credential chain) | Converse API; `src/llm/bedrock.ts` is the only Bedrock-specific code. |

```bash
# OpenAI
COMBINATOR_LLM_PROVIDER=openai OPENAI_API_KEY=sk-... npm run combinator -- run-all

# Amazon Bedrock (configuration only)
COMBINATOR_LLM_PROVIDER=bedrock AWS_REGION=us-east-1 \
  BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0 npm run combinator -- run-all
```

Every run reports provider, model, calls, tokens, approximate cost, retries, failures and processing time → `usage-report.json`. All model IDs, region, endpoints, timeouts and inference settings come from environment/configuration (`.env.example`).
**No secret is ever written to a workspace, log, or client bundle.**

---

## Cost & usage reporting

Every run writes `usage-report.json` with: `provider, model, calls, inputTokens, outputTokens, retries, failures, approxCostUsd, processingMs`.

**Cost model.** Approximate cost is computed from token counts and a configurable per-1K-token price:

```
approxCostUsd = inputTokens/1000  * COMBINATOR_COST_PER_1K_INPUT
             + outputTokens/1000 * COMBINATOR_COST_PER_1K_OUTPUT
```

Defaults (override in `.env` to match your contract):

| Var | Default (USD / 1K tokens) |
| --- | --- |
| `COMBINATOR_COST_PER_1K_INPUT` | 0.00015 |
| `COMBINATOR_COST_PER_1K_OUTPUT` | 0.0006 |

**Mock-mode cost.** `mock` makes no network calls and incurs **no real cost**. Token counts are *estimated* (chars/4) only so the reporting pipeline is exercised identically to a live provider; the reported `approxCostUsd` for mock is therefore a synthetic
figure, not a charge.

**Typical footprint.** The LLM is used only for short narration (architecture summaries, idea summaries, synthesis prose) — a handful of small calls per challenge (observed: 2 per code challenge, ~7 for the ideation challenge). All decision logic,
matrices, verification and integrity are computed without the LLM, so switching to a live provider adds modest cost and never changes the grounded facts.

**Controls.** `COMBINATOR_LLM_MAX_TOKENS`, `COMBINATOR_LLM_TEMPERATURE` (default 0 for reproducibility), 
`COMBINATOR_LLM_TIMEOUT_MS`, `COMBINATOR_LLM_MAX_RETRIES` bound every call; 
retries and failures are counted in the usage report.

---

## Security model

Full detail in [`docs/SECURITY.md`](docs/SECURITY.md). In brief:

- Source submissions/reviews/scorecards/schemas/verification are **read-only**; all writes are **confined** to `workspace/.../combined-solution/` (or `synthesized-concept/`) and the tool's own workspace metadata, enforced by `SafeFs`.
- **Path traversal and symlink escapes are rejected**; every file-modifying operation is **audited** (`audit-log.json`).
- **SHA-256** of every source artifact is recorded **before and after**; any mismatch is a **critical failure** (`integrity/integrity-report.json`).
- Source code and documents are treated as **untrusted**: no macros or embedded active content are executed; document parsing is pure-JS.
- Nothing is hard-coded — challenge/submission/requirement IDs, paths, scores, winners and combinations are all discovered at runtime.

---

## Workspace output (per challenge)

```
workspace/CHALLENGE_ID/
├── workspace-manifest.json
├── review-context-status.json · active-review-context.json
├── review-context-reconciliation.json · source-location-map.json
├── overview.md
├── submissions/<SUB>/profile.json | ideas.json
├── requirement-matrix.json · requirement-matrix.md
├── decisions.json
├── provenance.json
├── contradictions.json
├── verification.json
├── usage-report.json · audit-log.json
├── integrity/integrity-report.json
├── combined-solution/      # code mode
├── synthesized-concept/    # ideation mode
└── review-ui/README.md
```

---

## Schemas

All shapes are defined in [`src/types.ts`](src/types.ts). Summary:

**review-context-status.json** — `{ challengeId, status: "supplied"|"absent", mode:
"provided_with_spec_reconciliation"|"specification_derived", detail }`

**active-review-context.json** — `{ challengeId, mode, recordId|null, status|null,
requirements: Requirement[] }` where `Requirement = { id, title, priority, constraints:
{id,text,specificationDerived?}[], specificationDerived?, sourceLocation? }`.

**review-context-reconciliation.json** — `{ challengeId, mode, missingInContext[],
missingInSpecification[], conflicts:{id,field,contextValue,specificationValue}[],
stale[], notes[] }`

**source-location-map.json** — `{ [id]: SourceLocation }` where `SourceLocation =
{ kind, submissionId?, ideaId?, path?, startLine?, endLine?, locator?, excerpt? }`;
`kind ∈ file|function|test|readme_section|page|slide|table|figure|speaker_note|
reviewer_comment|scorecard|verification|specification`.

**submissions/\<SUB\>/profile.json** (code) — `CodeSubmissionProfile`: applications[],
architecture, build, tests, requirementCoverage[{requirementId,state,score,evidence,
notes}], strengths[], weaknesses[], reviewEvidence[], compatibilityRisk,
baseSuitability{score,reasoning}.

**submissions/\<SUB\>/ideas.json** (ideation) — `IdeaProfile[]`: ideaId, title, problem/
proposedAgents/sdlcPhases/workflow/data/integrations/humanOversight/security/…,
evaluation{originality|feasibility|scalability|impact_potential|alignment_with_scope →
{state,reasoning,evidence}}, evidence[].

**requirement-matrix.json** — `{ challengeId, mode, rows: MatrixRow[], conflicts:
Conflict[] }`; `MatrixRow = { requirementId, requirementTitle, cells:{sourceId,state,
score,evidence,confidence,compatibilityRisk}[], recommendedSource, reasoning,
confidence, unresolvedConflicts }`; `Conflict.type ∈ human_vs_ai | review_vs_source |
uncertain_evidence | contradiction`.

**decisions.json** — `{ challengeId, mode, decisions: Decision[] }`; `Decision = { id,
kind, title, requirementId?, options:{id,sourceId,label,evidence,compatibilityRisk}[],
recommendation, reasoning, risk, state, selectedSource, copilotComment,
regenerationRequired, updatedAt }`; `state ∈ pending|accepted|rejected|
alternative_selected|blocked|manual_review|unresolved`.

**provenance.json** — `{ challengeId, mode, entries: {target, sourceId, sourcePath?,
decisionId, evidence, generated, note?}[] }`; `generated:true` marks agent-generated
bridging/assumptions.

**contradictions.json** — `{ challengeId, mode, contradictions: Conflict[] }`

**verification.json** — `{ challengeId, mode, candidate, overall: passed|failed|partial|
not_verifiable, steps:{name,command?,state,detail,durationMs?}[], honestSummary,
sourceIntegrityOk }`.

**integrity/integrity-report.json** — `{ challengeId, before: HashRecord[], after:
HashRecord[], mismatches:{path,before,after}[], critical }`; `HashRecord =
{path,sha256,bytes}`.

**usage-report.json** — `{ provider, model, calls, inputTokens, outputTokens, retries,
failures, approxCostUsd, processingMs }`

**workspace-manifest.json** — `{ challengeId, title, mode, generatedAt,
combinatorVersion, reviewContextMode, artifacts[], usage, integrityCritical,
verificationOverall }`

All outputs are human-readable, machine-readable, reproducible (deterministic in mock
mode), and consumable by another AI assistant.

---

## Tests

```bash
npm test
```

Covers deterministic IDs, `SafeFs` write-confinement + traversal/symlink rejection, integrity mismatch detection, the decision state machine, the transplant-margin logic, review-vs-source conflict detection, and contradiction detection.

---

## Limitations (honest)

- **Requirement coverage** uses grounded keyword/structure heuristics, not deep semantic program analysis; it is bounded to avoid rewarding repository size, but a human Copilot should confirm borderline cells.
- **Dynamic verification** (install/build/start/test) is **opt-in** (`--verify-exec`)
  and depends on the host toolchain; without it those steps are honestly `skipped`.
  Large polyglot submissions may not build in a constrained environment — this is reported, never masked as success.
- **Original scorecard re-evaluation** is `not_verifiable` here because the starter
  pack ships normalized score stubs without a re-runnable scorecard definition; the tool refuses to fabricate it.
- **OCR** for scanned PDFs is not included; such pages are marked `not_verifiable`.

---

