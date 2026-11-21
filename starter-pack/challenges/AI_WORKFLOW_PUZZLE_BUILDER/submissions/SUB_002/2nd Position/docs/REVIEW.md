# Reviewer walkthrough

A linear, 12-minute pass that exercises every scored requirement, with the exact result
to expect at each step. Grouped by scorecard category so you can score as you go.

Every step runs **offline in mock AI mode**. No API key, no account, no network, no
backend, no database.

---

## 0 · Setup (1 minute)

Prerequisites: **Node.js 20 or newer** and npm. (Verified working on Node 20 and 24.)

```bash
npm install
npm run dev
```

Open **http://localhost:5173**.

If you have run the app before, start clean: DevTools → Application → Clear site data,
or `localStorage.clear()` in the console. The home screen should read **0/8 puzzles solved**.

> Prefer not to install anything? If a hosted link was included with the submission, the
> deployed app is identical — the same bundle, same mocks, same determinism.

---

## 1 · Automated checks (1 minute, no UI)

```bash
npm test
```

**Expect 92 passing tests.** These are worth more than a glance, because they prove the
seed content rather than just the plumbing:

- every puzzle's **naive workflow fails the way the puzzle teaches**,
- every committed **solution survives every one of its failure scenarios**,
- every **completion goal is actually reachable** — so no seeded puzzle can be unsolvable.

Optional:

```bash
npm run typecheck   # strict TypeScript, clean
npm run lint        # ESLint, clean
npm audit           # 0 vulnerabilities
npm run verify      # all of the above plus a production build
```

---

## 2 · Orientation (30 seconds)

On the home screen, click **🧭 Reviewer guide**.

It lists 13 capabilities, each with a **Show me** button that opens the right puzzle,
arms the right failure scenario, and loads a working workflow — so any single capability
below can be reached in one click if you would rather not follow this linearly.

Close it and continue.

---

## 3 · Workflow builder and completeness — *25%*

Open **Fix the Meeting Summarizer** (Beginner).

1. The **Mission** panel shows the objective, expected output shape, and completion goals.
2. The **phase strip** under the header shows the loop: Understand → Run baseline →
   Break it → Repair → Prove resilience. It advances on real milestones.
3. The canvas shows the starting workflow: **Sample Input → Summarize notes → Final Output**.
4. Click **Summarize notes** — the inspector opens with model choice, retry budget,
   fallback target, and exhausted-policy controls.

**Build something.** Any of these work, and all three are equivalent:

- press **+** on the *Validator* block in the shelf, or
- drag the Validator from the shelf into a drop zone between steps, or
- use **↑ ↓** on a card to reorder and **✕** to remove.

**Keyboard path** (no mouse required): `Tab` to a step card, `Enter` opens the inspector,
`Alt`+`↑`/`↓` reorders, `Delete` removes. Cards carry aria-labels naming the step, kind,
and status.

> ℹ️ Retry and Fallback are **upgrade chips attached to AI/Tool steps** (🔁 / 🪂 in the
> shelf) rather than free-standing blocks — dropped with the same gesture, but bound to a
> specific step. Rationale in README → Assumptions.

---

## 4 · Failure handling and recovery — *25%*

Still in Puzzle 1:

| Do | Expect |
|---|---|
| Click **▶ Run workflow** (no scenarios) | **80/100 · Resilient** |
| Tick **🫠 Sloppy JSON**, run again | **41/100 · Fragile**, Output integrity **0/20** |

Read that second result carefully — it is the point of the whole app. The run reports
**completed** with green checkmarks, but the reliability report says *"The run 'succeeded'
but shipped invalid data — the most dangerous failure mode."* Nothing in the naive design
was watching.

| Do | Expect |
|---|---|
| Add the **Validator** (`+`), run | **100/100 · Rock solid**, delta `41 → 100 (+59)`, AI step 💪 Recovered |
| Tick **👻 Missing owner** too, run | **87/100**, validator chip 🛑 **Safely stopped** |
| Click the Validator, tick **🔧 Repair automatically**, run | **100/100**, ⭐ Solved, confetti |

That sequence demonstrates the distinction the puzzles teach: retry fixes a *fluke*,
repair fixes a *predictable defect*, and a safe stop is a deliberate outcome — not a crash.

### Retry vs fallback

Open **Activate the Fallback** (Advanced). Turn on **⚡ instant pace**.

| Do | Expect |
|---|---|
| Tick **🌤️ Atlas brownout**, run naive | **6/100 · Brittle** — one timeout kills the run |
| Add **🔁 Retry ×2**, run | **93/100** — retries ride out the brownout |
| Untick brownout, tick **⛈️ Atlas outage**, run | **6/100** — retries hammer a dead service |
| Add **🪂 Fallback: Pocket-7B**, run | **93/100**, strengths list *Fallback activated* |

> 93 rather than 100 is correct: the design-hygiene lint still wants a validator on that
> structured output. The report grades the **design**, not just the run.

### Checkpoint and resume

Open **Resume the Interrupted Mission** (Advanced).

| Do | Expect |
|---|---|
| Tick **☀️ Solar flare**, run | **21/100**, status *interrupted*, 💾 **Resume** button appears |
| Click **💾 Resume from last successful step** | **93/100**, **3 steps Restored** (not re-executed) |

### Determinism

Re-run any of the above. Identical results every time — failures are scripted per
`(scenario, attempt, provider)`, with no randomness anywhere in the engine or the mocks.

---

## 5 · Validation and human review — *15%*

Open **Approve Before Sending** (Intermediate). Tick **🎭 The over-promiser**. Add the
**Approval Gate** (`+`) and move it above *Send email* with **↑**.

Run. The workflow **pauses** and a modal shows the actual draft — which guarantees the
problem will never recur and offers a full year of refunds. Schema-valid; no validator
catches a bad promise. Only a person can.

Exercise all three decisions:

- **✅ Approve & continue** — proceeds.
- **✏️ Edit payload** — a JSON editor validated live against the step's schema; the save
  button stays disabled while the payload is invalid.
- **🛑 Reject** — run **stops safely at 87/100**, and *Send email* never runs (it has no
  status chip at all).

Every decision, including the optional note, appears in the trace as
**🙋 Human decision: …**.

### The full escalation ladder

Open **Validate the Data Extractor** (Advanced), tick all three scenarios, run.

Watch three different fixes handle three different defects:

1. **retry** clears the markdown-fence fluke,
2. **repair** converts `"twelve hundred dollars"` → `1200`,
3. **a human** supplies the contact email — the one fact no machine can invent.

Note the modal shows `amountUSD: 1200` **already repaired**, with only one outstanding
issue. Partial repairs are kept and handed on rather than discarded, and the trace labels
that step **Partial repair** so the record stays honest.

Paste `s.ito@brightleaf.example` into `contactEmail` to finish.

---

## 6 · Execution trace and reliability feedback — *15%*

**🧾 Trace tab** — every run records, with timestamps: step inputs and outputs, each
attempt and which provider/tool served it, retries, fallback activations, validation
results with issues, repairs (before/after payloads), branch decisions with reasons,
pauses, human decisions, checkpoints, safe stops, and the final result. Expand any
**data** link to see the payload.

Clicking a step card also shows that step's last input and output in the inspector.

**📊 Reliability tab** — a 0–100 score across four axes (run outcome, output integrity,
chaos handling, design hygiene), plus:

- **💪 Recovery behaviour observed** — what actually happened this run,
- **🕳️ Unresolved weaknesses** — a static lint of the current design: armed scenarios with
  no countermeasure, structured AI output with no downstream guard, validators that can
  detect but not recover.

From the second run onward it also shows the **before → after delta**.

---

## 7 · UX — *10%*

- **Responsive:** narrow the window below 860px. The three columns become a single pane
  with a bottom tab bar (Mission · Build · Run · Trace · Score). Every feature, including
  the human-review modal and the full inspector, works at phone width.
- **Keyboard:** see §3. Focus rings are visible; `prefers-reduced-motion` is respected.
- **Recovery:** **↺ Reset** restores any puzzle's starting workflow. Corrupt or stale
  saved state self-heals on load, with an error boundary as a backstop.

---

## 8 · Code quality — *5%*

```
src/engine/      workflow model, executor, resilience + validation ladders, trace events
src/puzzles/     committed seed content — one file per puzzle
src/providers/   optional live Anthropic call
src/reliability/ run scoring + weakness lint
src/state/       zustand store, pure workflow edit operations, persistence
src/ui/          React components
```

That split mirrors the separation the challenge spec itself recommends. 127 tests, strict
TypeScript, clean lint, 0 vulnerabilities, no `eval` / `innerHTML` /
`dangerouslySetInnerHTML`, and exactly one `console` call (the error boundary's crash log).

---

## 9 · Documentation — *5%*

- [`README.md`](../README.md) — setup, builder usage, seeded puzzles, failure simulation,
  retry/fallback, validation and human review, optional provider, mock mode, deployment,
  architecture, assumptions, known limitations.
- [`docs/architecture.md`](architecture.md) + [`architecture.svg`](architecture.svg).
- [`docs/security-review.md`](security-review.md) — attack surface and a scan-triage table.
- [`docs/demo-script.md`](demo-script.md) — the demo walkthrough.

---

## 10 · Mock mode and the optional provider

The **🧪 MOCK AI** badge is visible on every run. Everything above ran with it.

⚙️ **Settings** documents the optional live Anthropic provider. It is **off by default**
and nothing in this walkthrough, the tests, or the completion goals depends on it. If you
enable it, the app discloses exactly where the key is stored and offers a one-click
**Clear stored key**.

---

## Quick reference — expected results

| Step | Expect |
|---|---|
| `npm test` | 92 passing |
| P1 clean run | 80 · Resilient |
| P1 + Sloppy JSON, naive | 41 · Fragile, integrity 0/20 |
| P1 + Validator | 100 · `41 → 100 (+59)` |
| P1 + Missing owner | 87 · Safely stopped |
| P1 + Repair | 100 · Solved |
| P5 reject | 87 · Send step never runs |
| P7 brownout naive → +retry | 6 → 93 |
| P7 outage retry-only → +fallback | 6 → 93 |
| P8 flare → resume | 21 → 93, 3 restored |
