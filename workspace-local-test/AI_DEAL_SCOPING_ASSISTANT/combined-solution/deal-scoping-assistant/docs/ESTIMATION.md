# How the estimate is calculated

- Plain arithmetic. Same inputs, same numbers, every time.
- Every number carries a trace (label, formula, inputs, result) you can redo on paper.
- The AI never produces a figure. It only suggests workstreams, units and their complexity.

## Inputs

| Input | Where it comes from |
|---|---|
| Estimate drivers | AI suggestion, editable: units (capabilities, integrations, AI use cases, components, data domains) with a complexity, workstreams, phases, milestones |
| Scope items | The reviewed requirements, questions, assumptions and gaps. They set confidence, never effort |
| Session inputs | Rate card, contingency %, security level, testing level, environments, data migration, team sizes, productivity, expected users, delivery date |
| Rate card | Rate per role per person-week. Carries its currency. No exchange rates. A session can override single role rates; the override is written to the assumptions |
| Rule tables | `backend/seeds/config/estimation_defaults.json`: base effort, factors, overheads, spreads, rounding, team sizes, role mixes. Each table has a note |

## The eight steps

| # | Step | Formula |
|---|---|---|
| 1 | Unit effort | `unit_effort = base_person_weeks x factor_product`. Base from the table for unit type and complexity (integrations by pattern: api, event, batch, file). Factors: security level, testing level, environments; data migration on data and integration units only. `workstream_effort = sum of unit_effort` |
| 2 | Confidence, before any range | Four signals per workstream: share of inferred or assumed requirements, open questions, unconfirmed assumptions, missing information. The worst signal wins. Each one that fired is written out |
| 3 | Effort range | `low = effort x (1 - spread)`, `high = effort x (1 + spread)`. Spread 10% at high confidence, 20% at medium, 35% at low. This is base effort, no contingency |
| 4 | Overheads | Discovery & Architecture 12%, Testing & Hardening 18%, Deployment & Handover 8% of build effort. Each is its own line, phase and milestone |
| 5 | Timeline | `workstream_weeks = effort / (team_size x productivity x phases_spanned)`. A workstream listed in several phases spans them, so its duration is shared evenly and never counted twice. Workstreams in a phase run in parallel: `phase_weeks = max`. `timeline = sum of phase_weeks`. Milestones sit at the end of their phase |
| 6 | Contingency and ROM | Blended rate = `sum of role_share x role_rate` for the workstream's role mix (or the single rate you typed). `ROM = effort x blended_rate x (1 + contingency_pct / 100)`. Contingency is applied once, here. "Effort incl. contingency" is shown for information only |
| 7 | Overall confidence and rounding | Lowest workstream level, one step lower per session-level problem (no user volume, deadline risk, a blocked line). ROM rounds to the nearest 1,000 at high, 5,000 at medium, 10,000 at low. Effort to whole person-weeks. Weeks to one decimal |
| 8 | Missing inputs | Every gap is named with what it affects. Nothing is filled in silently |

## Worked example

Same numbers as `backend/tests/unit/estimation/test_worked_example.py`.

Setup: one workstream, two capabilities, USD rate card, two environments, standard security and testing, no migration, contingency 15%.

| Step | Result |
|---|---|
| 1 | CAP_01 medium = 3.0, CAP_02 high = 6.0, all factors 1.0. Workstream = 9.0 person-weeks |
| 2 | All requirements customer stated, nothing open. Confidence high |
| 3 | Spread 10%. Range 8.1 to 9.9 |
| 4 | Overheads: 0.97–1.19, 1.46–1.78, 0.65–0.79 |
| 5 | Team sizes 3, 5, 3, 2, productivity 1.0. Phases 0.3 / 1.6 / 0.5 / 0.3 to 0.4 / 2.0 / 0.6 / 0.4 weeks. Timeline 2.7 to 3.4 weeks. "Go live" at week 3.4 |
| 6 | Per line: effort x blended rate x 1.15. Example: 9.90 x 7,700 x 1.15 = 87,664.50 |
| 7 | ROM 100,063.11 to 122,263.17. High confidence, so rounded to **100,000 to 122,000 USD**. Effort 11 to 14 person-weeks (13 to 16 incl. contingency, information only) |
| 8 | No delivery date given. Timeline shown as a range with a note. Nothing blocked |

## When something is missing

| Situation | What happens |
|---|---|
| No rate card, or a role the card does not price | That ROM line is blocked with the reason, left out of the total, total marked partial. Effort and timeline still calculated |
| Explicit rate mode with no rate | Every ROM line blocked |
| No expected users while scalability or performance requirements exist | Confidence drops. Infrastructure lines say why |
| No delivery date | Timeline stays a range, with a note |
| Delivery date earlier than the high timeline | Delivery risk raised, confidence one step lower |
| Unit with unknown workstream, integration with unknown pattern, complexity with no rule | Error entry with the reason. Never guessed, never dropped |
| Any default used (contingency, team size, role mix, workstream type, overhead %) | Listed in plain words under "assumptions" |

Historical projects shown next to the estimate are context only. They never enter the calculation.
