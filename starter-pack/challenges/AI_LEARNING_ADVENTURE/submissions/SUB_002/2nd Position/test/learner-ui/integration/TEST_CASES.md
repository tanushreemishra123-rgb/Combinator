# Learner UI Integration Test Cases

## Test Environment

- Test location: `test/learner-app/integration`
- Render the real learner React application with Redux and SWR in JSDOM.
- Run the real backend API in process on an ephemeral loopback port.
- Use a fresh in-memory database and deterministic seed fixtures for each test.
- Drive interactions with Testing Library and `userEvent` using accessible roles, names, and labels.
- Verify important persistence effects through both the UI and backend API.
- Block unexpected external requests. Run AI cases in mock-only or unconfigured mode unless provider failure is being tested.

Implementation status: 86 executable cases are implemented across seven integration suites. `SET-03` through `SET-06` and `A11Y-05` remain explicit `it.todo` cases because the learner UI does not currently expose progress export/import/sample-loading or presentation-mode controls.

Priority definitions:

- P0: Critical learner journey or smoke coverage.
- P1: Important workflow and state coverage.
- P2: Lower-risk interaction or presentation coverage.

## Journey And Navigation

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| JRN-01 | P0 | New learner opens the app and selects `Start the adventure`. | The first published Beginner mission opens and its progress becomes `in_progress`. |
| JRN-02 | P0 | Learner advances within a mission, returns home, and selects `Continue your adventure`. | The same mission resumes at the furthest persisted step. |
| JRN-03 | P1 | Learner with completed missions continues the journey. | The recommended next incomplete mission opens. |
| JRN-04 | P1 | Learner selects `Explore missions` from Home. | The mission map opens without changing progress. |
| JRN-05 | P1 | Learner navigates among Home, Missions, Review, Progress, and AI Only Mode. | The correct view and heading appear, and browser history navigation works. |
| JRN-06 | P1 | The frontend is remounted after the learner has started a journey. | Persisted progress and the resume target are restored from the backend. |

## Mission Browser

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| BRW-01 | P0 | Learner opens the mission map. | All published missions display with the correct available, locked, in-progress, or completed state. |
| BRW-02 | P0 | Learner selects an available mission node. | The selected mission opens. |
| BRW-03 | P1 | Learner selects a locked mission. | Navigation is prevented and prerequisite guidance appears. |
| BRW-04 | P0 | Learner toggles from Map to List and uses a row action. | The list appears and the matching mission opens. |
| BRW-05 | P1 | Learner filters by difficulty, track, and status. | Only missions matching the intersection of the active filters remain visible. |
| BRW-06 | P1 | Learner clears active filters. | The full published catalog returns. |
| BRW-07 | P1 | Learner toggles Map/List while filters are active. | The active filters remain applied. |
| BRW-08 | P2 | Learner sorts the mission list by each supported column. | Rows appear in the selected order. |
| BRW-09 | P1 | The app is remounted after the learner selects List view. | The stored view preference is restored. |
| BRW-10 | P1 | Learner opens a completed mission. | The mission opens in review posture with the prior score visible. |

## Mission Learning Flow

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| MSN-01 | P0 | Learner starts a mission. | The title, objective, difficulty, track, and Lesson step render. |
| MSN-02 | P0 | Learner advances from Lesson to Example to Checkpoint. | Steps unlock sequentially and the furthest step persists. |
| MSN-03 | P1 | Learner navigates backward and selects a previously visited step. | The selected visited step opens. |
| MSN-04 | P1 | Learner attempts to select an unreached step. | The step remains disabled and the mission does not skip ahead. |
| MSN-05 | P1 | Learner selects a lesson key term. | A flashcard popover opens with a link to the full deck. |
| MSN-06 | P1 | Learner reveals a scenario takeaway. | The authored takeaway becomes visible. |
| MSN-07 | P0 | Learner submits a single-question checkpoint. | An acknowledgement and explanation appear, and the Quiz step unlocks. |
| MSN-08 | P1 | Learner submits a written-response checkpoint. | The response is accepted and mock/sample feedback is clearly labeled. |
| MSN-09 | P1 | Learner submits bucket-sorting and spot-the-problem checkpoints. | Corrective feedback appears without assigning a score. |
| MSN-10 | P0 | Learner leaves before the quiz and the frontend is remounted. | The mission resumes at the persisted furthest step. |
| MSN-11 | P1 | Learner returns from a mission to the browser. | The prior map/list state and mission progress are preserved. |

## Quiz

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| QIZ-01 | P0 | Learner starts the quiz after checkpoint completion. | The first question and question counter appear. |
| QIZ-02 | P0 | Learner selects and submits the correct single-select answer. | A correct verdict, authored explanation, and locked selection appear. |
| QIZ-03 | P1 | Learner changes an answer before submitting. | Only the final selection is evaluated. |
| QIZ-04 | P1 | Learner submits a partially correct multi-select answer. | The answer is incorrect and missed correct options are identified. |
| QIZ-05 | P1 | Learner answers true/false and scenario questions. | Each control type submits and displays the appropriate explanation. |
| QIZ-06 | P1 | Learner reviews a previously answered question. | The prior question is read-only and retains its verdict. |
| QIZ-07 | P0 | Learner leaves mid-quiz and the frontend is remounted. | The quiz resumes at the next unanswered question. |
| QIZ-08 | P0 | Learner completes a passing attempt. | Results show the score and `Passed`, and the attempt is persisted. |
| QIZ-09 | P0 | Learner completes a failing attempt. | Results show `Needs review` and identify the weakest topic. |
| QIZ-10 | P1 | Learner expands a results recap row. | The question, selected answer, verdict, and explanation appear. |
| QIZ-11 | P0 | Learner retries and earns a better score. | A new attempt is appended, and both best and latest scores update. |
| QIZ-12 | P1 | Learner retries and earns a lower score. | The latest score changes while the best score is retained. |
| QIZ-13 | P0 | Learner passes the quiz without submitting the checkpoint. | The mission remains incomplete. |
| QIZ-14 | P0 | Learner submits the checkpoint and passes the quiz. | The mission becomes completed exactly once. |

## Flashcards And Review

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| FLD-01 | P0 | Learner opens a mission flashcard deck and flips the first card. | The definition, example, common mistake, and learning tip appear. |
| FLD-02 | P1 | Learner navigates with Next and Previous. | The card counter and content change correctly. |
| FLD-03 | P1 | Learner marks a card `Got it`. | The card is persisted as known. |
| FLD-04 | P0 | Learner marks a card `Needs work`. | The concept is added to weak topics. |
| FLD-05 | P1 | Learner finishes the deck. | The summary shows known and needs-work totals. |
| FLD-06 | P1 | Learner selects `Review needs-work only`. | Only weak cards are included in the new pass. |
| REV-01 | P0 | Learner opens Review with weak topics. | Weak topics appear ranked with review controls. |
| REV-02 | P1 | Learner opens a topic-specific review deck. | The deck contains only cards matching that topic. |
| REV-03 | P1 | Learner marks every review card `Got it`. | The weak topic clears and the empty state appears. |
| REV-04 | P1 | Learner opens Review without weak topics. | An encouraging empty state appears. |

## Completion, Progress, And Awards

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| PRG-01 | P0 | Learner completes a mission. | The completion panel appears and completion percentage increases. |
| PRG-02 | P0 | Learner completes a mission with a badge. | The badge dialog appears once and the award persists. |
| PRG-03 | P1 | Learner returns to the mission map after completion. | The node displays its completed state and badge. |
| PRG-04 | P0 | Learner opens the Progress dashboard. | Completion, mission count, level, scores, weak topics, and awards match backend state. |
| PRG-05 | P1 | Learner completes the last mission in a track. | The current level advances and a level-up banner appears. |
| PRG-06 | P1 | Learner reaches a milestone threshold. | A milestone reveal appears and the milestone persists. |
| PRG-07 | P1 | Learner accepts the suggested next mission. | The recommended mission opens. |
| PRG-08 | P1 | Learner accepts a suggested review topic. | The topic-filtered review deck opens. |
| PRG-09 | P1 | Learner completes every mission. | A journey-complete state replaces the next-mission recommendation. |

## Tutor And AI Only Mode

Run these tests in mock-only or unconfigured mode to prohibit external AI traffic.

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| AI-01 | P0 | Learner opens the inline tutor from a lesson. | The tutor opens with mission and step context. |
| AI-02 | P0 | Learner sends a tutor question. | A clearly labeled sample response appears. |
| AI-03 | P1 | Learner uses simpler explanation, example, and summary actions. | The corresponding structured sample responses appear. |
| AI-04 | P1 | Learner requests a quiz hint. | A hint appears without containing any correct option text. |
| AI-05 | P1 | Learner requests explanations after correct and incorrect answers. | The response matches the submitted answer posture. |
| AI-06 | P1 | Learner closes and reopens the tutor. | The conversation is retained within the mission. |
| AI-07 | P0 | Learner enters AI Only Mode and asks a question. | A grounded sample response appears with the current scope. |
| AI-08 | P1 | Learner changes AI Only scope to a mission. | Subsequent responses and context reference that mission. |
| AI-09 | P1 | Learner exercises all AI Only quick actions. | Each action renders its expected picker or response. |
| AI-10 | P1 | Learner starts and advances a conversational walkthrough. | Authored mission steps appear and walkthrough position persists. |
| AI-11 | P1 | Learner exits and reopens AI Only Mode. | The conversation, mission scope, and walkthrough position return. |
| AI-12 | P0 | Learner uses an AI feature with no provider configured. | The setup notice and a labeled sample response both appear. |
| AI-13 | P1 | The configured provider request fails. | A visible error appears and the app provides labeled fallback content. |
| AI-14 | P0 | Recorded requests are inspected after AI interactions. | No request reaches an unapproved external endpoint. |

## Progress Management

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| SET-01 | P0 | Learner resets progress and confirms. | Backend progress clears and Home returns to its start state. |
| SET-02 | P1 | Learner cancels progress reset. | Existing progress remains unchanged. |
| SET-03 | P1 | Learner exports progress. | The downloaded snapshot contains completions, scores, awards, and weak topics. |
| SET-04 | P1 | Learner imports a valid snapshot and confirms. | Existing progress is replaced and the UI refreshes. |
| SET-05 | P1 | Learner imports an invalid snapshot. | A validation error identifies the problem and progress remains unchanged. |
| SET-06 | P1 | Learner loads sample progress. | The expected mid-journey state and resume target appear. |
| SET-07 | P0 | Two learner IDs use the same in-process API. | Their progress remains isolated. |
| SET-08 | P1 | One of two learners resets progress. | The other learner's state remains unchanged. |

## Resilience And Accessibility

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| RES-01 | P0 | Catalog bootstrap fails. | A visible error and recovery action appear instead of a blank screen. |
| RES-02 | P1 | Mission loading fails. | An error is presented without corrupting learner progress. |
| RES-03 | P0 | A progress mutation fails. | The UI does not claim false completion and offers recovery. |
| RES-04 | P1 | Learner retries a failed request. | The view recovers and the successful mutation occurs once. |
| A11Y-01 | P1 | Learner completes the core journey using keyboard controls. | Interactive controls are reachable and operable. |
| A11Y-02 | P1 | Learner opens and closes dialogs. | Focus enters the dialog and returns to its trigger. |
| A11Y-03 | P1 | Learner completes a mission. | The progress change is announced through a live region. |
| A11Y-04 | P1 | Each primary learner view is opened. | A unique H1 and appropriate landmarks identify each screen. |
| A11Y-05 | P2 | Learner enables presentation mode. | Presentation styling activates without changing progress. |

## Implementation Order

1. Implement P0 cases as the integration smoke suite.
2. Add P1 cases by feature area.
3. Add P2 sorting and presentation coverage.
4. Verify the suite with:

```bash
pnpm --dir test/learner-app/integration typecheck
pnpm --dir test/learner-app/integration test
```
