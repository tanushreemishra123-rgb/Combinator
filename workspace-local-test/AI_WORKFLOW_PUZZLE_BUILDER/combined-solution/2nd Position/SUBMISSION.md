# Submission notes — AI Workflow Puzzle Builder

**Workflow Puzzle Lab** — a browser-based visual puzzle game for learning resilient AI
workflow design. Assemble a workflow, break it on purpose with deterministic failures, and
repair it with retries, fallbacks, validators, safe stops, and human review.

| | |
|---|---|
| **Live app** | https://workflow-puzzle-lab.vercel.app |
| **Demo video (3:11)** | https://drive.google.com/file/d/19Iznyl-GEV4Q8YSsTeXDoo9XnZdHLJ-u/view?usp=sharing |
| **Run locally** | `npm install && npm run dev` → http://localhost:5173 |
| **Verify everything** | `npm run verify` (typecheck + 127 tests + production build) |
| **Paid AI access needed** | **No.** Mock AI mode is the canonical path — offline, deterministic, no keys. |
| **Backend / database** | None. Client-only SPA (forum: *"An in-memory store is sufficient… a database is not mandatory."*) |

---

## Start here: the 90-second review path

1. `npm install && npm run dev`, open http://localhost:5173
2. Click **🧭 Reviewer guide** in the header — 13 capabilities, each a **one-click jump**
   that opens the right puzzle with the right failure already armed. Nothing to set up by
   hand.
3. Or follow the guided path in [docs/REVIEW.md](docs/REVIEW.md).

If you only run one thing, run this: open **Fix the Meeting Summarizer**, press
**▶ Run workflow**, then tick **🫠 Sloppy JSON** and run again. The run reports
*completed* with green checkmarks — and the reliability report scores **Output integrity
0/20**, because the workflow shipped unparseable data. That contrast is the thesis of the
whole submission.

---

## Where each required deliverable lives

| Requirement | Where |
|---|---|
| Visual workflow builder | `src/ui/Canvas.tsx`, `src/ui/Palette.tsx`, `src/ui/Inspector.tsx` |
| Pre-seeded puzzles (8) | `src/puzzles/*.ts` — 18 failure scenarios, 27 completion criteria |
| Execution engine | `src/engine/engine.ts` |
| Failure simulation | `src/engine/engine.ts` (deterministic chaos keyed on scenario + attempt), per-puzzle `failureScenarios` |
| Retry / fallback | `src/engine/engine.ts` (attempts → retries → fallback → `onExhausted`) |
| Validation + human review | `src/engine/validation.ts`, `src/ui/HumanReviewModal.tsx` |
| Execution trace | `src/engine/types.ts` (`TraceEvent`, 19 kinds), `src/ui/TracePanel.tsx` |
| Reliability feedback | `src/reliability/report.ts`, `src/ui/ReportPanel.tsx` |
| Mock AI + optional live provider | `src/puzzles/blocks.ts` (mocks), `src/providers/live.ts`, `src/ui/SettingsModal.tsx` |
| README (all 10 sections) | [README.md](README.md) |
| Architecture diagram | [docs/architecture.svg](docs/architecture.svg) + [docs/architecture.md](docs/architecture.md) |
| Demo video | link above; script in [docs/demo-script.md](docs/demo-script.md) |

---

## Design decisions worth knowing before scoring

**Linear workflow with conditional branching, not a general graph engine.** Confirmed
sufficient on the forum (*"A linear workflow with conditional branching is sufficient. A
full graph-based workflow engine is not required."*). The budget freed by skipping a graph
editor went into the two areas that answer names as the focus — failure handling and
execution tracing.

**Retry and Fallback are step-attached upgrade chips, not free-floating blocks.** They are
dragged from the same block shelf with the same gesture, and drop onto a specific AI/Tool
step. Binding them to a step is strictly more precise than a standalone block, which would
have to infer its target. Visible as 🔁/🪂 badges on the step card.

**Two failure planes, deliberately.** Hard failures (timeouts, outages) throw and are
caught by retry/fallback. Soft failures (malformed JSON, missing fields) do *not* throw —
they flow onward as data, exactly as they would in production. This is why a run can report
"completed" and still be scored as a failure. It is the central lesson of the lab, not a bug.

**Accessibility is built in, not bolted on.** Every dialog is a real `role="dialog"` with a
focus trap, Escape-to-dismiss and focus restoration — except the human-review gate, which
deliberately resists both Escape and backdrop clicks because the decision is the point of
the pause. The Mission/Trace/Reliability tabs are a proper `tablist` with arrow-key
navigation. A live region announces the run starting, any human-review pause, and the final
verdict, so the core loop is usable without sight. Purely decorative elements (score bars
that duplicate their own text, mouse-only drop zones) are `aria-hidden` rather than faking
interactivity.

**Every drag has a click equivalent.** `+` quick-add on each shelf item, ↑ ↓ reorder, ✕
remove, and full retry/fallback configuration in the inspector. All 8 puzzles are solvable
without ever dragging anything — which is also the accessible and touch path.

---

## Verification performed

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | **127/127 passing** |
| `npm run build` | succeeds |
| `npm audit` | **0 vulnerabilities** |
| Every puzzle solvable | proven in `src/puzzles/puzzles.test.ts` |
| Every completion criterion reachable | proven by scripted playbook in the same suite |
| **Mock determinism actually proven** | every puzzle × every scenario combination replayed twice and compared byte-for-byte |
| CSP verified against the real production bundle | played to 100/100, zero violations |
| Corrupt/stale localStorage | self-heals, no white screen (error boundary + load guard) |

Determinism is the claim most worth distrusting, so it is the one with the most direct
evidence: `mock mode is deterministic` runs every puzzle against every scenario
combination twice and compares the entire run — status, counters, recovery, final
output and the full ordered trace — byte-for-byte, with only genuine wall-clock
fields normalised away. A companion test asserts a *different* scenario set produces a
*different* run, so the comparison cannot pass vacuously.

The puzzle test suite is the one worth opening: it proves, for all 8 puzzles, that (a) the
naive workflow fails the way the puzzle teaches, (b) the committed solution survives every
scenario set, and (c) every completion criterion is actually reachable.

---

## Known limitations (stated plainly)

- Conditions do not nest inside condition branches — one level of branching.
- HTML5 drag-and-drop does not fire for touch, so on a phone the click/button path is the
  primary one. Every action has one.
- An in-flight human-review pause does not survive a browser refresh; checkpoints do.
- Live AI mode is optional and untested against a real key in review conditions by design —
  no puzzle, criterion, or test depends on it.
- The reliability delta compares against the previous run in the same session only.

More detail in [README.md → Known limitations](README.md#known-limitations) and the
security posture in [docs/security-review.md](docs/security-review.md).
