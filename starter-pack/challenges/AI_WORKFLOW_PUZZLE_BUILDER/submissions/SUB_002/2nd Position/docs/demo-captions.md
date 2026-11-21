# Recording sheet — steps + captions

A shot list for the 4-minute demo. Each row is **one action** and **one caption**.

Captions are written to work either way: read them aloud as narration, or burn them in as
on-screen text. Each is ≤ 14 words so it fits one line and stays readable at 1080p.

Every expected result below was dry-run against the built app.

---

## Before you hit record

```bash
npm run dev          # http://localhost:5173
```

- Browser window ~**1440×900**, zoom **100%**.
- `localStorage.clear()` in the console → home screen must read **0/8 puzzles solved**.
- **⚡ instant pace OFF** for Puzzle 1, **ON** from Puzzle 5.
- Close other tabs, hide bookmarks, silence notifications.
- A run takes about **1 second** — never wait for an animation, keep moving.

---

## Shot list

### 0:00 – 0:20 · Opening

| # | Action | Caption |
|---|---|---|
| 1 | Home screen, still | **Workflow Puzzle Lab** — learn to build AI workflows that don't fall over |
| 2 | Slow scroll through the puzzle grid | 8 puzzles · beginner → advanced |
| 3 | Hover the 🧪 MOCK AI wording in the footer | Runs fully offline in mock AI mode — no API key, no backend |
| 4 | Hover **🧭 Reviewer guide** | Reviewer guide: one click jumps to any capability, failure pre-armed |

### 0:20 – 1:15 · Puzzle 1 — a run that "succeeds" and still ships garbage

| # | Action | Caption |
|---|---|---|
| 5 | Click **Fix the Meeting Summarizer** | Every puzzle opens with objective, expected output, and completion goals |
| 6 | Point at the phase strip | The loop: understand → run → break → repair → prove |
| 7 | Point at the canvas | The starting workflow is naive on purpose: input → AI → output |
| 8 | Click **▶ Run workflow** | Run it clean first |
| 9 | Report panel lands on **80** | 80 / 100 · Resilient |
| 10 | Tick **🫠 Sloppy JSON** | Now inject a controlled failure — deterministic, repeats every run |
| 11 | Click **▶ Run workflow** | The model wraps its answer in markdown chatter |
| 12 | Report lands on **41** — hold 3s | It says *completed*. Green checkmarks. And it shipped invalid data. |
| 13 | Point at **Output integrity 0/20** | Output integrity 0 / 20 — the most dangerous failure mode |
| 14 | Open **🧾 Trace**, expand the last `data` | Nothing in this design was watching for it |

### 1:15 – 1:50 · Repair it — the escalation ladder

| # | Action | Caption |
|---|---|---|
| 15 | Press **+** on *Validator* in the shelf | Add a Validator between the model and the output |
| 16 | Click **▶ Run workflow** | It checks the output against a schema, then escalates |
| 17 | Report **100**, delta pill visible | 41 → 100 (+59) · one retry fixed the formatting fluke |
| 18 | Point at *Summarize notes* 💪 Recovered | The AI step recovered — the trace shows both attempts |
| 19 | Tick **👻 Missing owner**, run | Different failure: a missing owner, on *every* attempt |
| 20 | Report **87**, validator 🛑 Safely stopped | Retrying can't fix it — so it stopped safely instead |
| 21 | Click the Validator, tick **🔧 Repair automatically** | Repair handles what retrying can't |
| 22 | Click **▶ Run workflow** → confetti | Solved · all three goals met |

### 1:50 – 2:35 · Puzzle 5 — human review

| # | Action | Caption |
|---|---|---|
| 23 | ← Puzzles → **Approve Before Sending**; turn **⚡ instant pace ON** | Some failures no schema can catch |
| 24 | Tick **🎭 The over-promiser** | |
| 25 | Press **+** on *Approval Gate*, then **↑** to move it above *Send email* | Put a human in front of the send step |
| 26 | Click **▶ Run workflow** → modal opens | The run pauses before anything leaves the building |
| 27 | Point at the draft text — hold 3s | It guarantees this will never recur and refunds a full year |
| 28 | Click **✏️ Edit payload**, tidy the wording | Approve, edit, or reject — edits are schema-checked live |
| 29 | Add a note, **Save edit & continue** | |
| 30 | Open **🧾 Trace**, point at 🙋 Human decision | Every decision, with its note, lands in the trace |
| 31 | Run again → **🛑 Reject** → confirm | And a rejection is respected |
| 32 | Point at *Send email* — no status chip | Stopped safely at 87. The send step never ran. |

### 2:35 – 3:10 · Puzzle 7 — retries vs fallbacks

| # | Action | Caption |
|---|---|---|
| 33 | ← Puzzles → **Activate the Fallback** | |
| 34 | Tick **🌤️ Atlas brownout**, run | The flagship model times out |
| 35 | Report **6 · Brittle** | One timeout, whole run dead |
| 36 | Press **+** on *Retry ×2*, run | Give it a bounded retry budget |
| 37 | Report **93** | Retries ride out a brownout — the trace shows all three attempts |
| 38 | Untick brownout, tick **⛈️ Atlas outage**, run | Now the model is down hard |
| 39 | Report **6** again | Retries just hammer a dead service |
| 40 | Press **+** on *Fallback: Pocket-7B*, run | So fall back to a smaller model that's actually up |
| 41 | Report **93**, point at *Fallback activated* | A plainer answer that still passes the schema |

### 3:10 – 3:40 · Puzzle 8 — interruption and resume

| # | Action | Caption |
|---|---|---|
| 42 | ← Puzzles → **Resume the Interrupted Mission** | |
| 43 | Tick **☀️ Solar flare**, run | A solar flare kills the pipeline mid-run |
| 44 | Report **21**, point at 💾 Resume button | But a checkpoint saved every completed step |
| 45 | Click **💾 Resume from last successful step** | |
| 46 | Point at the 💾 Restored chips | Three steps restored, not re-executed — it continues where it died |
| 47 | Report **93** | An interruption becomes a pause, not a restart |

### 3:40 – 4:00 · Close

| # | Action | Caption |
|---|---|---|
| 48 | Open **📊 Reliability** | Every run is scored: outcome, integrity, chaos handling, design hygiene |
| 49 | Point at *Recovery behaviour observed* / *Unresolved weaknesses* | What survived — and what's still fragile in the design |
| 50 | Open **⚙️ Settings** | All of this ran offline in mock mode |
| 51 | Point at the live-provider section | A real model is optional, never required |
| 52 | ← Puzzles, home screen with stars | Eight puzzles. Retries, fallbacks, validation, human review, resume. |

---

## Coverage check — all 11 required beats

| Required beat | Shots |
|---|---|
| Selecting a puzzle | 5 |
| Building / modifying a workflow | 15, 21, 25, 36, 40 |
| Running normally | 8–9 |
| Triggering a controlled failure | 10, 19, 34, 38, 43 |
| Observing the failed step | 12–14, 20, 35, 39 |
| Retry behaviour | 16–18, 36–37 |
| Fallback behaviour | 40–41 |
| Validating structured output | 15–17 |
| Approve / edit / reject | 26–32 |
| Reviewing the execution trace | 14, 30, 48 |
| Reliability feedback | 9, 12, 48–49 |
| Mock AI mode | 3, 50–51 |

Bonus beats this submission can show: **safe stop** (20, 32), **checkpoint resume** (42–47),
**before → after delta** (17), **reviewer guide** (4).

---

## Silent recording? Use the subtitle file

[`demo-captions.srt`](demo-captions.srt) contains these same captions with timings for a
4-minute cut. Upload it in YouTube Studio → your video → Subtitles → Add → Upload file
(with timing). Adjust timings there if your pacing differs.

## After recording

1. Upload to **YouTube (unlisted), Loom, or Vimeo** — *not* Google Drive.
2. Paste the link into the `▶ Live demo` area at the top of [`../README.md`](../README.md).
3. Add it to the submission notes.
