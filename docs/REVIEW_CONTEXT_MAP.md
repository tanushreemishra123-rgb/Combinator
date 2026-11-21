# Review-context coverage map

How each of the nine review contexts is satisfied, with **source-code**, **generated
workspace artifact**, **test**, and **runtime verification** evidence. Paths are
relative to the repo root; workspace paths are under `workspace/<CHALLENGE_ID>/`.

---

### 1. Multi-Challenge Input and Review-Context Handling
- **Input ingestion / per-challenge isolation:** `src/ingest.ts` (`loadManifest`,
  `discoverChallenge`) — manifest-driven discovery, one challenge processed at a time;
  nothing combined across challenges.
- **Review context supplied *and* missing:** `src/review-context.ts` — supplied →
  `provided_with_spec_reconciliation` (IDs preserved, reconciled); absent
  (`NOT_PROVIDED`) → `specification_derived` with deterministic stable IDs.
- **Artifacts:** `review-context-status.json`, `active-review-context.json`,
  `review-context-reconciliation.json`, `source-location-map.json`.
- **Evidence:** the ideation fixture shows the derived path; the three code fixtures show
  the supplied+reconciled path.

### 2. Submission Analysis and Evidence Accuracy
- **Code profiling (monorepo-aware):** `src/profiling/code.ts` — detects nested apps,
  stacks, build/test, requirement coverage with file-level evidence and a bounded,
  size-independent strength score.
- **Every claim references a source location:** all evidence carries `SourceLocation`
  (`file/function/test/page/slide/...`) — see `submissions/<SUB>/profile.json`.
- **Assessment states:** `complete | partial | missing | not_verifiable |
  manual_review_required` (`src/types.ts`).

### 3. Requirement Mapping and Review-Evidence Reconciliation
- **Requirement matrix + evidence fusion:** `src/evidence.ts` — per-requirement status
  by source, recommended source, confidence, compatibility risk.
- **Conflicts surfaced, reviewer not trusted blindly:** `review_vs_source` /
  `human_vs_ai` detection; reviewer comments are not treated as automatically correct.
- **Artifacts:** `requirement-matrix.json` + human-readable `requirement-matrix.md`;
  review loading in `src/reviews.ts` (honest about normalized score stubs).
- **Tests:** `test/pipeline.test.ts` (review-vs-source conflict).

### 4. Copilot Decision Workspace and Regeneration Loop
- **Decisions with the seven states:** `src/decisions.ts` (`DecisionState` state machine,
  `applyDecisionChange`).
- **Regeneration on change:** `src/cli.ts decide` and `src/server.ts` `/api/decide`
  re-run the pipeline with saved decisions overlaid (`overlay()` in
  `src/orchestrator.ts`); verification + provenance refresh.
- **Review UI (files are source of truth):** `src/server.ts` + `public/index.html`.
- **Artifacts:** `decisions.json`. **Tests:** decision transitions in
  `test/unit.test.ts`.

### 5. Code Candidate Combination and Compatibility
- **Base + one-transplant-at-a-time with rollback:** `src/codemode/transplant.ts` —
  base chosen by requirement wins; transplants only on a clear per-requirement margin;
  donor files namespaced under `combined-solution/_transplants/` so the base build is
  not silently broken; failed transplant rolls back and is marked `blocked`.
- **No false success / no required free-form merge:** candidate never reported successful
  on failure (`src/codemode/verify.ts`).
- **Artifacts:** `combined-solution/`, `provenance.json`. **Tests:** transplant-margin
  logic in `test/pipeline.test.ts`.

### 6. Ideation Document Analysis and Best-of-All Synthesis
- **DOCX/PDF/PPTX ingestion with locations:** `src/ideation/docingest.ts` (pure-JS;
  speaker notes; unreliable extraction flagged `not_verifiable`).
- **Up to 3 ideas/submission, 5 evaluation areas:** `src/profiling/ideation.ts`.
- **Contradictions exposed, one coherent concept, labeled assumptions:**
  `src/ideation/synthesize.ts`.
- **Artifacts:** `submissions/<SUB>/ideas.json`, `synthesized-concept/concept.md`,
  `contradictions.json`. **Tests:** contradiction detection in `test/pipeline.test.ts`.

### 7. Immutable Source Protection and Secure Execution
- **Read-only sources, write-confinement, traversal/symlink rejection:**
  `src/fs-safe.ts` (`SafeFs`, `SourceProtectionError`).
- **SHA-256 before/after; any mismatch critical:** `src/integrity.ts`;
  `integrity/integrity-report.json`.
- **Disposable analysis dirs / ZIP extraction with zip-slip guard:**
  `src/materialize.ts`. Build/test run on the copied candidate, never the original.
- **Untrusted docs:** pure-JS parsing, no macro/active-content execution
  (`docs/SECURITY.md`). **Tests:** write-confinement, traversal, symlink-escape,
  integrity-mismatch in `test/unit.test.ts`.

### 8. Mode-Specific End-to-End Verification
- **Code verification steps:** `src/codemode/verify.ts` — dependency install, build,
  startup, smoke, unit/integration, regression, approved-capability, scorecard
  re-evaluation, source-integrity; honest states (dynamic steps `skipped` unless
  `--verify-exec`, never falsely `passed`).
- **Ideation verification:** `src/ideation/synthesize.ts` — mandatory areas covered,
  accepted present / rejected absent, contradictions decided, claims traceable,
  assumptions labeled.
- **Artifacts:** `verification.json` (both modes), `overview.md`.

### 9. Generality, Provider Portability, and Local Reviewability
- **No hard-coding:** challenge/submission/requirement IDs, paths, scores, winners and
  combinations are discovered at runtime; all generated artifact paths are relativized
  (`relativizePaths` in `src/util.ts`) — no absolute paths in any artifact.
- **Provider portability:** one adapter interface `src/llm/adapter.ts`; `mock`
  (default, deterministic, keyless), `openai` (default live), `bedrock` (config-only).
  Usage/cost in `usage-report.json`.
- **Local reviewability & reproducibility:** `--pack` accepts the ZIP or the extracted
  folder (`src/materialize.ts`); runs fully offline in mock mode; output is
  deterministic (identical across runs); README documents every command. Container:
  `Dockerfile` / `docker-compose.yml`.

---

**Verification of claims:** run `npm test` (automated tests), `npm run combinator --
run-all --pack <pack>` (regenerates every artifact above), and `npm run ui` (inspect and
change decisions). Every statement here points to code and to a regenerated artifact.
