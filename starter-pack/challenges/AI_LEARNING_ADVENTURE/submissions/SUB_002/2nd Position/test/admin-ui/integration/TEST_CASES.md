# Admin UI Integration Test Cases

## Test Environment

- Test location: `test/admin-ui/integration`.
- Render the real admin React pages with SWR in JSDOM.
- Run the real backend API in process on an ephemeral loopback port.
- Use a fresh in-memory database and deterministic seed fixtures for each test.
- Stub Next.js routing only at the framework boundary and support route parameters and navigation assertions.
- Drive interactions with Testing Library and `userEvent` using accessible roles, names, and labels.
- Verify important persistence effects through both the UI and backend API.
- Use an isolated SWR cache for each render and clear DOM, storage, timers, globals, and server resources after each test.
- Block unexpected external requests.
- Stub URL, Blob, and download behavior for content export tests.

Implementation status: all cataloged cases are implemented as executable Vitest integration coverage. Related cases share a test where one user flow proves both outcomes (for example, cancel followed by confirm). Test execution is intentionally separate from implementation.

Priority definitions:

- P0: Critical content-management workflow or smoke coverage.
- P1: Important workflow, relationship, validation, and state coverage.
- P2: Lower-risk drag-and-drop or presentation coverage.

## Test Harness

The integration harness should provide:

- `renderAdminPage(route)` to mount the real page for a route.
- A test router supporting `push`, route parameters, and navigation assertions.
- `remountAdminPage()` to verify persisted state after a fresh UI mount.
- An `apiFetch` implementation that redirects `/api/v1/*` requests to the in-process API.
- Request logging and API interception for error, validation, and conflict scenarios.
- Seeded item lookup by title and entity type.
- Direct API helpers for creation, retrieval, update, revision inspection, and relationship verification.
- Accessible drivers for tables, menus, selects, dialogs, and editors.

## Inventory

Run shared cases for missions, questions, flashcards, and awards where applicable.

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| INV-01 | P0 | Admin opens each content inventory. | Seeded rows, titles, relationships, and statuses render. |
| INV-02 | P0 | Admin selects `New`. | A draft is created and the correct editor route opens. |
| INV-03 | P0 | Admin searches by title, stem, concept, or name. | Only matching rows remain. |
| INV-04 | P1 | Admin searches with mixed case and surrounding whitespace. | Search is trimmed and case-insensitive. |
| INV-05 | P0 | Admin filters by publication status. | Only rows with the selected status remain. |
| INV-06 | P1 | Admin filters missions by difficulty and level track. | Results match the selected difficulty and track. |
| INV-07 | P1 | Admin filters questions or flashcards by mission. | Only content assigned to that mission remains. |
| INV-08 | P1 | Admin filters questions or flashcards by `Unassigned`. | Only unassigned content remains. |
| INV-09 | P1 | Admin combines search and multiple filters. | Results satisfy the intersection of all active criteria. |
| INV-10 | P1 | Admin clears active search and filters. | The complete inventory returns. |
| INV-11 | P0 | Admin selects an item title. | The matching editor route opens. |
| INV-12 | P1 | Admin selects `Actions > Edit`. | The matching editor route opens. |
| INV-13 | P1 | Admin duplicates an item. | A separate draft copy appears and the source remains unchanged. |
| INV-14 | P0 | Admin starts deletion and cancels the confirmation. | The item remains visible and persisted. |
| INV-15 | P0 | Admin confirms deletion. | The item disappears and the API reports it archived. |
| INV-16 | P1 | Admin disables and re-enables non-mission content. | Enabled state persists and the row status updates. |
| INV-17 | P1 | Admin disables a mission and cancels its warning. | The mission remains enabled. |
| INV-18 | P1 | Admin confirms disabling a mission. | The mission becomes disabled and hidden from learner content. |
| INV-19 | P1 | Admin selects one row and performs a bulk enable or disable action. | The selected item changes state and selection clears. |
| INV-20 | P1 | Admin selects all visible rows and performs a bulk action. | Every visible selected item changes state. |
| INV-21 | P1 | Admin bulk publishes or unpublishes selected items. | Each successful item has the expected persisted status. |
| INV-22 | P1 | A bulk action partially fails. | Failed count and message appear while successful changes remain persisted. |
| INV-23 | P1 | Search or filters produce no results. | An empty state appears and offers item creation. |
| INV-24 | P1 | A question or flashcard assignment changes. | Mission practice counts refresh to match backend relationships. |

## Shared Editor Behavior

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| EDT-01 | P0 | Admin edits a required field and saves. | The saved value persists after remounting the page. |
| EDT-02 | P1 | Admin edits a field without selecting Save draft. | The value remains unsaved until manually selecting `Save draft`. |
| EDT-03 | P0 | Admin attempts to save invalid content. | Validation feedback appears and the persisted revision does not advance. |
| EDT-04 | P1 | Admin toggles enabled state in an editor. | The state persists and matches the inventory. |
| EDT-05 | P1 | Admin opens an unknown item ID. | A load error and working return action appear. |
| EDT-06 | P1 | Another request updates the item before the admin saves. | A revision-conflict message appears and stale content is not persisted. |
| EDT-07 | P1 | A save request fails. | Unsaved input remains visible and an actionable error appears. |
| EDT-08 | P1 | Admin changes a field, saves, and returns to inventory. | The updated title and status appear in the matching row. |

## Mission Editor

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| MSN-01 | P0 | Admin edits mission basics and saves. | Title, slug, objective, difficulty, track, order, duration, threshold, and prerequisite persist. |
| MSN-02 | P1 | Admin adds and edits a lesson block. | The new block and content persist. |
| MSN-03 | P1 | Admin removes a lesson block. | The block is absent after save and remount. |
| MSN-04 | P1 | Admin moves lesson blocks up and down. | Their persisted order matches the UI. |
| MSN-05 | P1 | Admin switches among paragraph, list, callout, and key-term block types. | Type-specific controls and persisted structures update correctly. |
| MSN-06 | P1 | Admin links a key term to a flashcard. | The flashcard relationship persists. |
| MSN-07 | P1 | Admin switches between worked-example and scenario forms. | Only the selected example structure is persisted. |
| MSN-08 | P1 | Admin switches checkpoint kinds. | The selected kind and its type-specific fields persist. |
| MSN-09 | P1 | Admin adds, removes, and selects a correct checkpoint option. | Option content and correctness persist. |
| MSN-10 | P1 | Admin edits advanced checkpoint JSON with valid JSON. | The parsed checkpoint structure updates. |
| MSN-11 | P1 | Admin enters invalid checkpoint JSON. | A parse error appears and the prior valid structure is retained. |
| MSN-12 | P1 | Admin unassigns a question from the Practice section. | The question becomes unassigned and counts refresh. |
| MSN-13 | P1 | Admin unassigns a flashcard from the Practice section. | The flashcard becomes unassigned and counts refresh. |
| MSN-14 | P1 | Admin opens a linked practice item or award. | Navigation opens the correct editor. |

## Question Editor

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| QST-01 | P0 | Admin creates and saves a valid multiple-choice question. | The question persists and appears in inventory. |
| QST-02 | P1 | Admin adds and removes answer options. | The final option set persists. |
| QST-03 | P1 | Admin changes the correct answer in single-answer mode. | Exactly one persisted option is correct. |
| QST-04 | P1 | Admin selects multi-answer mode and marks multiple answers correct. | All selected correct options persist. |
| QST-05 | P1 | Admin changes the type to true/false. | Canonical True and False options appear with one correct answer. |
| QST-06 | P1 | Admin changes the type to scenario and enables written reasoning. | Scenario text and reasoning preference persist. |
| QST-07 | P1 | Admin changes mission assignment, tags, and difficulty. | Relationships and metadata persist. |
| QST-08 | P2 | Admin reorders answer options. | The new option order persists. |
| QST-09 | P1 | Admin edits question content. | The learner preview updates before saving. |

## Flashcard Editor

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| FLC-01 | P0 | Admin creates and saves a valid flashcard. | Concept, definition, example, supporting text, tags, and difficulty persist. |
| FLC-02 | P1 | Admin assigns a flashcard to a mission. | The relationship persists and inventory filtering finds the card. |
| FLC-03 | P1 | Admin changes a flashcard to `Unassigned`. | The mission relationship is cleared. |
| FLC-04 | P1 | Admin edits the card and flips its preview. | Front and back reflect current unsaved form values. |
| FLC-05 | P1 | Admin omits both common mistake and learning tip. | Save is blocked with validation feedback. |

## Award Editor

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| AWD-01 | P0 | Admin creates a badge linked to a mission. | The badge and mission-completion rule persist. |
| AWD-02 | P1 | Admin changes a badge to a milestone. | Badge-only mission linkage clears and a milestone rule appears. |
| AWD-03 | P1 | Admin configures a mission-completed milestone. | The selected mission rule persists. |
| AWD-04 | P1 | Admin configures a track-completed milestone. | The selected track rule persists. |
| AWD-05 | P1 | Admin configures a score-threshold milestone. | Threshold and optional mission persist. |
| AWD-06 | P1 | Admin configures a streak milestone. | The streak length persists. |
| AWD-07 | P1 | Admin configures a percent-complete milestone. | The completion threshold persists. |
| AWD-08 | P1 | Admin enters an invalid threshold or omits a required relationship. | Save is blocked with validation feedback. |

## Publishing

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| PUB-01 | P0 | Admin publishes a valid draft. | Status becomes `Published` in the editor and inventory. |
| PUB-02 | P0 | Admin publishes dirty content. | Changes save before the publish gate opens. |
| PUB-03 | P0 | Admin attempts to publish invalid content. | Blocking validation issues appear and status remains draft. |
| PUB-04 | P1 | Admin cancels the publish dialog. | Publication status remains unchanged. |
| PUB-05 | P1 | Admin edits published content and saves. | Status becomes `Published with changes`. |
| PUB-06 | P0 | Admin republishes changed content. | Status returns to `Published` and the published snapshot updates. |
| PUB-07 | P0 | Admin starts unpublishing and cancels. | The item remains published. |
| PUB-08 | P0 | Admin confirms unpublishing. | The item becomes a draft and learner access is removed. |
| PUB-09 | P1 | Admin publishes a mission including dependent drafts. | Eligible dependent content is published after acknowledgement. |
| PUB-10 | P1 | Admin publishes a mission without including dependent drafts. | Dependent content remains draft. |
| PUB-11 | P1 | An item revision changes while the publish dialog is open. | Publish reports a conflict and does not overwrite newer content. |
| PUB-12 | P1 | Admin previews a mission. | A preview token is requested and a learner preview URL appears. |
| PUB-13 | P1 | Admin publishes an item multiple times. | Publication history records the successive events. |

## Practice Assignments

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| ASN-01 | P0 | Admin assigns an unassigned question through its mission select. | The question moves to the mission and the API relationship updates. |
| ASN-02 | P0 | Admin assigns an unassigned flashcard through its mission select. | The flashcard moves to the mission and the API relationship updates. |
| ASN-03 | P1 | Admin moves practice content between missions. | The source and destination lists refresh correctly. |
| ASN-04 | P1 | Admin moves assigned practice content to `Unassigned`. | Its mission relationship clears. |
| ASN-05 | P1 | Admin moves assigned content up or down. | Persisted display order matches the board. |
| ASN-06 | P1 | Admin searches the unassigned library. | Only matching unassigned items remain visible. |
| ASN-07 | P1 | Admin switches between Questions and Flashcards. | Each tab displays its independent assignment data. |
| ASN-08 | P2 | Admin performs a keyboard drag assignment. | The assignment persists without pointer input. |
| ASN-09 | P1 | An assignment request fails. | An alert appears and the board restores backend state. |

Use select and move-button flows for primary integration coverage. Keep pointer drag tests limited because JSDOM drag geometry is fragile.

## Curriculum

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| CUR-01 | P0 | Admin opens Curriculum. | Matrix totals match seeded mission tracks and difficulties. |
| CUR-02 | P1 | Track ordering contains a gap. | A progression warning identifies the affected track. |
| CUR-03 | P1 | A track mixes difficulty levels. | A progression warning identifies the affected track. |
| CUR-04 | P0 | Admin reorders missions within a track. | Contiguous `trackOrder` values persist in the new order. |
| CUR-05 | P1 | A reorder request fails. | An error appears and server ordering is restored. |
| CUR-06 | P1 | Admin selects a curriculum mission. | The matching mission editor opens. |

## Settings And Content Data

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| SET-01 | P0 | Admin opens Settings. | Seed counts and integrity checks match the backend. |
| SET-02 | P1 | Admin starts seed reload and cancels. | Current content remains unchanged. |
| SET-03 | P0 | Admin confirms seed reload. | Admin edits are replaced by seed content and the UI refreshes. |
| SET-04 | P1 | Admin exports content. | A JSON bundle is generated with the expected filename and current content. |
| SET-05 | P0 | Admin selects a valid bundle in merge mode. | A dry-run report appears without mutating content. |
| SET-06 | P1 | Admin selects replace mode for a valid bundle. | A replacement dry-run report appears without mutating content. |
| SET-07 | P0 | Admin applies a validated import. | Added and updated items appear as drafts in inventory. |
| SET-08 | P1 | Admin selects an invalid JSON file. | A parse error appears and no import request is sent. |
| SET-09 | P1 | Admin selects a structurally invalid bundle. | Invalid entities appear in the report and existing content remains safe. |
| SET-10 | P1 | The import request fails. | An error appears and existing content remains unchanged. |
| SET-11 | P1 | The export request fails. | An error appears and no download is triggered. |

## Resilience And Accessibility

| ID | Priority | Test Case | Expected Result |
|---|---|---|---|
| RES-01 | P0 | Inventory loading fails. | An error and Retry action appear instead of a blank page. |
| RES-02 | P1 | Admin retries a failed inventory request. | Rows load successfully without duplicate mutations. |
| RES-03 | P1 | Editor loading fails. | A recoverable error and return action appear. |
| RES-04 | P0 | Create, update, or delete fails. | The UI does not claim success or corrupt visible state. |
| RES-05 | P1 | Duplicate or bulk action fails. | An actionable error appears and persisted data remains consistent. |
| RES-06 | P1 | Assignment or reorder fails after an optimistic update. | The UI reconciles with backend state. |
| RES-07 | P1 | A request targets an external endpoint. | The test fails immediately. |
| A11Y-01 | P1 | Admin completes create, edit, publish, and delete using keyboard controls. | Interactive controls are reachable and operable. |
| A11Y-02 | P1 | Admin opens and closes confirmation and publish dialogs. | Focus enters the dialog and returns to its trigger. |
| A11Y-03 | P1 | Admin uses inventory controls. | Search, filters, row selection, and actions have accessible names. |
| A11Y-04 | P1 | A mutation or load request fails. | The error is exposed through an appropriate alert role. |
| A11Y-05 | P1 | Each primary admin page opens. | A unique heading and appropriate landmarks identify the page. |
| A11Y-06 | P2 | Admin operates the assignment board without pointer input. | Practice content can be reassigned and reordered using keyboard controls. |

## Implementation Order

1. Build the harness, fixtures, API helpers, isolated SWR setup, and Next.js router stub.
2. Implement P0 inventory CRUD and shared editor-save cases.
3. Add publishing, unpublishing, and deletion confirmation cases.
4. Add entity-specific editor cases.
5. Add assignment, curriculum, and settings data flows.
6. Add validation, conflict, failure-recovery, keyboard, and accessibility coverage.
7. Add P2 drag-and-drop cases last.

## Verification

```bash
pnpm --dir test/admin-ui/integration typecheck
pnpm --dir test/admin-ui/integration test
```
