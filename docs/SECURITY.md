# Security model

The Combinator treats the starter pack as **untrusted input** and protects it
rigorously. All controls are enforced in code, not by convention.

## 1. Source protection (read-only inputs)
- Submissions, reviews, scorecards, schemas and verification fixtures are **never
  written to**. `SafeFs` (`src/fs-safe.ts`) only permits writes under explicitly
  registered **writable roots** — the per-challenge workspace and its
  `combined-solution/` / `synthesized-concept/` subtrees.
- A write targeting any source path throws `SourceProtectionError`.
- `challenge-package.json` declares `sourceInputsImmutable: true`; the tool honors it.

## 2. Path traversal & symlink escapes
- Every write path is resolved and checked to be inside a writable root; `..` segments
  are rejected.
- Reads resolve the **realpath** and verify it stays within permitted read roots, so a
  symlink pointing outside the pack cannot exfiltrate data.
- Covered by tests (`test/unit.test.ts`): write-confinement, traversal rejection,
  symlink-escape rejection.

## 3. Integrity (SHA-256 before/after)
- `hashTree` records the SHA-256 and size of every source artifact **before**
  processing and **after**. `diffHashes` flags any changed or missing source file.
- **Any mismatch is a critical failure** surfaced in
  `integrity/integrity-report.json` and the workspace manifest
  (`integrityCritical: true`).

## 4. Audit trail
- Every file-modifying operation (write, copy, mkdir, delete, rollback) is appended to
  an audit log written to `audit-log.json`.

## 5. Untrusted code & documents
- No code from submissions is executed during profiling. Dynamic verification is
  opt-in (`--verify-exec`) and, when enabled, runs the candidate's own commands with
  `shell: false`, a bounded timeout, and a capped output buffer.
- Document parsing (PDF/DOCX/PPTX) is **pure-JS** (`pdfjs-dist` with
  `isEvalSupported: false`, `mammoth`, `adm-zip` + `fast-xml-parser`). **Macros and
  embedded active content are never executed.**

## 6. Secrets & credentials
- Provider credentials come from environment/config and the standard AWS chain only.
- No API key, token or credential is ever written to a workspace artifact, the audit
  log, or any client-visible bundle. The review UI serves only workspace JSON.

## 7. Generality (no hard-coding)
- Challenge IDs, submission IDs, requirement IDs, paths, scores, winners and expected
  combinations are all discovered at runtime from the manifest and specifications.
  Different submission counts, stacks, repo layouts, document formats and verification
  commands are supported.
