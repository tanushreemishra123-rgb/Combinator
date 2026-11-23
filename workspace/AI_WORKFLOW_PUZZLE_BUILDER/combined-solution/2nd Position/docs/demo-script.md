# Demo video script (3–5 minutes)

> **Recording from this?** [`demo-captions.md`](demo-captions.md) is the same walkthrough
> as a numbered shot list with a ready caption per shot — easier to follow on camera.

Recording setup: `npm install && npm run dev`, browser at **http://localhost:5173**, window
at ~1440×900 so all three workspace columns are visible. Clear site data first so progress
starts at 0/8 (DevTools → Application → Clear site data, or run `localStorage.clear()` in
the console).

Leave **⚡ instant pace** OFF for the first puzzle so the status chips visibly flip, then
turn it ON from Puzzle 5 onward. Note: a demo-pace run of a 3–4 step workflow takes only
**about one second** — do not pause waiting for a long animation, just keep narrating.

Total target: **4 minutes**. Timings below are cumulative.

## Expected results at every beat

This whole script was dry-run against the built app; these are the actual numbers, so
nothing surprises you on camera.

| Beat | Action | Expect |
|---|---|---|
| 0:20 | P1 run, no chaos | **80** · Resilient |
| 0:50 | P1 + Sloppy JSON, naive | **41** · Fragile · Output integrity **0/20** |
| 1:15 | P1 + Validator | **100** · Rock solid · delta `41 → 100 (+59)` · AI step 💪 Recovered |
| 1:30 | P1 + Missing owner | **87** · validator chip 🛑 Safely stopped |
| 1:45 | P1 + Repair ticked | **100** · ⭐ Solved · confetti |
| 2:15 | P5 reject | **87** · Send email never runs (no status chip) |
| 2:35 | P7 brownout, naive | **6** · Brittle |
| 2:45 | P7 + Retry ×2 | **93** · Rock solid |
| 2:55 | P7 outage, retry only | **6** · Brittle |
| 3:05 | P7 + Pocket-7B fallback | **93** · Rock solid |
| 3:15 | P8 solar flare | **21** · 💾 Resume button appears |
| 3:30 | P8 resumed | **93** · 3 steps Restored |

**Why Puzzle 7 lands on 93, not 100:** the design-hygiene lint still wants a validator on
that structured output. Worth saying out loud rather than glossing — it shows the report
keeps grading the *design*, not just the run.

**Running short on time?** The 🧭 Reviewer guide's one-click jumps set up Puzzles 7 and 8
(right puzzle, scenario armed, working workflow) instantly. Keep the manual building in
Puzzle 1 and 5 — that is where the builder itself needs to be seen.

---

## 0:00 — 0:20 · What this is

*Home screen.*

> "This is Workflow Puzzle Lab — a puzzle game that teaches you how to build AI workflows
> that don't fall over. Eight puzzles, beginner to advanced. Everything runs locally in
> mock AI mode — no API key, no paid access, no backend."

*Point at the 🧭 Reviewer guide button.*

> "And if you're reviewing this: the reviewer guide lists every capability with a
> one-click jump that opens the right puzzle with the right failure already armed."

Point at the **🧪 MOCK AI** concept in the footer line, and the three difficulty sections.

## 0:20 — 1:15 · Puzzle 1: select, run, watch it ship garbage

*Click **Fix the Meeting Summarizer**.*

> "Each puzzle opens with a mission briefing: the objective, the expected output shape,
> and the completion goals. This one turns meeting notes into a structured summary."

*Point at the phase strip under the header.*

> "This strip is the loop every puzzle follows — understand it, run it, break it, repair
> it, prove it. It advances as you actually hit those milestones."

*Point at the canvas.* "The starting workflow is naive on purpose: input, one AI step,
output." *Click **▶ Run workflow**.*

> "Steps flip through their statuses, and the trace records every event live."

*(This takes about a second — keep talking, do not wait.)*

*Result: 80/100.* Then tick the **💥 Sloppy JSON** scenario.

> "Now I inject a controlled failure — the model wraps its answer in markdown chatter.
> Deterministic: it reproduces identically every run."

*Run again. Score drops to 41/100 "Fragile".*

> "Look at this — the run says *completed*. Green checkmarks everywhere. But the
> reliability report caught it: **output integrity 0 out of 20** — the run succeeded and
> shipped unparseable data. That's the most dangerous failure mode in AI workflows, and
> nothing in this design was watching for it."

*Open the **🧾 Trace** tab briefly, expand the final output data.*

## 1:15 — 1:50 · Repair it, and meet the escalation ladder

*Press **+** on the Validator block in the shelf (or drag it above Output).*

> "So I add a Validator. It checks the output against the puzzle's schema, and on failure
> it walks an escalation ladder."

*Run.* → **100/100 Rock solid**, the AI step shows **💪 Recovered**.

> "One retry, and the model came back with clean JSON — and the report shows the jump:
> 41 to 100. You can see exactly what the repair bought you."

*Now tick **👻 Missing owner** too, and run.* → safe stop.

> "Different failure: an action item with no owner, on *every* attempt. Retrying can't fix
> it — so the workflow stopped safely rather than shipping incomplete data. That's a
> deliberate outcome, and the report scores it as controlled behaviour."

*Click the Validator step, tick **🔧 Repair automatically**, run again.* → solved, confetti.

> "Repair fills the missing owner with an explicit *Unassigned* flag and notes it in the
> trace. All three goals met — puzzle solved."

## 1:50 — 2:35 · Puzzle 5: human review — approve, edit, reject

*Back to Puzzles → **Approve Before Sending**. Turn on **⚡ instant pace**. Tick **🎭 The
over-promiser**. Quick-add the **Approval Gate** and move it above the send step (↑).*

> "This workflow drafts a customer email and sends it. The failure here isn't malformed
> data — it's a *bad promise*. Schema-valid, and no validator on earth catches it."

*Run.* → modal opens.

> "The run pauses. A human sees the actual draft — and this one guarantees it'll never
> happen again and refunds a full year of fees."

*Click **✏️ Edit payload**, paste a calm version, add a note, **Save edit & continue**.*

> "I can approve, edit, or reject. Edits are validated live against the step's schema
> before I'm allowed to submit. Every decision, including my note, lands in the trace."

*Show the trace row: **🙋 Human decision: edit**.* Then run once more and hit **🛑 Reject**.

> "And a rejection is respected: the workflow stops safely and the send step never fires."

## 2:35 — 3:10 · Puzzle 7: retries vs fallbacks

*Puzzles → **Activate the Fallback**. Tick **🌤️ Atlas brownout**, run the naive workflow.*
→ fails.

> "The flagship model times out. One timeout, whole run dead."

*Drag the **🔁 Retry ×2** chip onto the AI step (or press its **+**). Run.* → recovered, **93**.

> "Retries ride out a brownout — the trace shows all three attempts."

*Switch to **⛈️ Atlas outage**, run.* → fails again.

> "But now the model is down hard. Retries just hammer a dead service."

*Drag the **🪂 Fallback: Pocket-7B** chip onto the same step. Run.* → recovered, **93**.

> "Three failed attempts on the flagship, then the switch, then a plainer answer from the
> small model — which still passes the schema. The report shows the fallback activated."

## 3:10 — 3:40 · Puzzle 8: interruption and resume

*Puzzles → **Resume the Interrupted Mission**. Tick **☀️ Solar flare**. Run.*

> "A solar flare kills the pipeline mid-composition. But look at the trace: a checkpoint
> was saved with every completed step."

*Point at the **💾 Resume from last successful step** button; click it.*

> "Resuming restores those three steps — the badges say *Restored from checkpoint*, they
> are not re-executed — and the run continues from where it died and transmits."

## 3:40 — 4:00 · Trace, reliability, and mock mode

*Open the **📊 Reliability** tab.*

> "Every run ends with this: a score across run outcome, output integrity, chaos handling,
> and design hygiene — plus the recovery behaviour that actually happened, and any
> weaknesses still left in the design."

*Open **⚙️ Settings**.*

> "And all of this ran in mock mode — deterministic, offline, reproducible. If you want
> real model calls you can drop in an Anthropic key here, but nothing in the puzzles
> requires it."

*Optional, ~8s — narrow the browser window until the mobile layout kicks in.*

> "And it works on a phone: same engine, single pane, run button under your thumb."

*Back to home screen showing solved stars.*

> "Eight puzzles, four failure classes, retries, fallbacks, validation, human review, and
> resumable runs — as a game."

---

## One-page cue card

Print or keep on a second screen. Each line is one on-camera action.

```
SETUP   localStorage.clear() · window ~1440x900 · instant pace OFF

P1  Fix the Meeting Summarizer
    run                         -> 80
    tick Sloppy JSON · run      -> 41  "completed, but integrity 0/20"
    + Validator · run           -> 100 "41 -> 100 (+59)"
    tick Missing owner · run    -> 87  safe stop
    Validator > Repair · run    -> 100 SOLVED (confetti)

P5  Approve Before Sending        [instant pace ON from here]
    tick over-promiser
    + Approval Gate · move up
    run -> modal -> Edit payload -> Save
    run -> modal -> Reject        -> 87, send step never ran

P7  Activate the Fallback
    tick brownout · run         -> 6   "one timeout, run dead"
    + Retry x2 · run            -> 93
    swap to outage · run        -> 6   "retries hammer a dead service"
    + Pocket-7B fallback · run  -> 93  "fallback activated"

P8  Resume the Interrupted Mission
    tick Solar flare · run      -> 21  checkpoint saved
    click Resume                -> 93, 3 steps Restored

CLOSE  Reliability tab · Settings (mock mode) · home screen stars
```

## Checklist of required demo beats

- [x] Selecting a puzzle — 0:20
- [x] Building / modifying a workflow — 1:15, 1:50, 2:35
- [x] Running normally — 0:20
- [x] Triggering a controlled failure — 0:50
- [x] Observing the failed step — 0:50, 2:35
- [x] Retry behaviour — 1:15, 2:35
- [x] Fallback behaviour — 3:10
- [x] Validating structured output — 1:15
- [x] Approving / editing / rejecting a human-review step — 1:50
- [x] Reviewing the execution trace — throughout, 3:40
- [x] Viewing reliability feedback — 0:50, 3:40
- [x] Running in mock AI mode — stated at 0:00, shown at 3:40
- [x] Reliability before → after delta — 1:15
- [x] Responsive/mobile layout — 3:55 (optional beat)
