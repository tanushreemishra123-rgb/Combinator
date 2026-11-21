# Demo script (≤ 5 minutes)

Covers the required flow: both review-context paths, evidence review, a Copilot
decision change, candidate generation, verification, provenance, and regeneration.

Record at 1280×720. Mock mode — no keys. Each `[mm:ss]` is a rough cue.

---

**[0:00] Intro (20s)**
"This is the Topcoder Combinator. It compares submissions from one completed
challenge, recommends the best source per requirement, lets a Copilot decide, and
generates a derived candidate with evidence, provenance and verification — all
offline in mock mode."

**[0:20] The pack (20s)**
```bash
npm run combinator -- list --pack ./starter-pack
```
"Four fixtures, nine submissions — three code, one ideation. Nothing is hard-coded;
it's all read from the manifest."

**[0:40] Generate everything (30s)**
```bash
npm run combinator -- run-all --pack ./starter-pack --out ./workspace
```
"Each challenge gets a full workspace. Note the two review-context modes: the code
fixtures say `provided_with_spec_reconciliation`; the ideation fixture was
`NOT_PROVIDED`, so context is `specification_derived` with deterministic IDs."
Show `review-context-status.json` for one of each.

**[1:10] Code mode — matrix & base+transplants (60s)**
Open `workspace/AI_LEARNING_ADVENTURE/requirement-matrix.md`.
"Per requirement, each submission's grounded coverage is scored. The base is the
submission that wins the most requirements; where the other submission wins by a clear
margin, the Combinator proposes a **transplant**." Open `decisions.json` — show the
base decision plus the transplant decisions. Open `combined-solution/_transplants/` —
"donor files are namespaced so the base build isn't broken." Open `provenance.json` —
"every part traces to a source and a decision."

**[2:10] Verification honesty (30s)**
Open `verification.json`. "Integrity and structural checks pass; dynamic steps are
`skipped` unless we pass `--verify-exec` — they are never reported as passed without
evidence. A failed candidate is never shown as successful."

**[2:40] The review UI + a decision change (60s)**
```bash
npm run ui
```
Open http://localhost:4600 → pick AI_LEARNING_ADVENTURE. "The UI reads the workspace
files — the source of truth." Click a transplant → **Reject**. "Changing a decision
triggers regeneration." Show the candidate rebuilt without that transplant and
verification/provenance refreshed.

**[3:40] Ideation mode (60s)**
Pick AGENTIC_AI_COMMUNITY_ENABLEMENT_SDLC. "Three documents — PDF, DOCX — parsed with
preserved page/slide/section locations. Up to three ideas per submission, each scored
against the five evaluation areas." Open `synthesized-concept/concept.md`. "One coherent
concept from the accepted ideas — not pasted summaries. Bridging statements are labeled
as assumptions; contradictions are exposed as trade-offs, not silently merged." Show the
ideation `verification.json` (all areas covered, accepted present, assumptions labeled).

**[4:40] Close (20s)**
"Deterministic in mock mode, OpenAI or Bedrock by configuration only, source integrity
verified by SHA-256, every claim grounded. Files are the source of truth and another AI
assistant can consume them directly."

---

### CLI alternative to the UI step (if screen-recording a browser is awkward)
```bash
# Reject a transplant and regenerate from the command line:
npm run combinator -- decide AI_LEARNING_ADVENTURE \
  --id <transplant-decision-id> --state rejected --pack ./starter-pack
```
