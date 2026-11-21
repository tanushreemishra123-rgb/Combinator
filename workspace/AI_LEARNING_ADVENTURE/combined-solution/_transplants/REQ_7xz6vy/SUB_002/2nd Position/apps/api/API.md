# API Contract

Base URL: `http://localhost:4000/api/v1` (port configurable via `API_PORT`/`PORT`, default `4000`).

All request/response bodies are JSON (`application/json; charset=utf-8`). Request bodies with writes
must use `Content-Type: application/json` and are limited to 256 KiB.

## Envelope

Every successful response (HTTP 200) is wrapped in:

```json
{
  "data": { },
  "meta": { "requestId": "uuid", "etag": "optional" }
}
```

Every error response is:

```json
{ "error": { "code": "validation_error", "message": "human readable", "requestId": "uuid" } }
```

### Error codes

| HTTP | code                   | when                                                        |
| ---- | ---------------------- | ----------------------------------------------------------- |
| 400  | `validation_error`     | invalid path segment, query param, body field, or JSON      |
| 404  | `not_found`            | unknown route, mission, or flashcard                        |
| 405  | `method_not_allowed`   | wrong HTTP method for a route                               |
| 409  | `idempotency_conflict` | same `idempotencyKey` replayed with a different payload     |
| 409  | `attempt_conflict`     | quiz attempt id already recorded for another learner        |
| 413  | `payload_too_large`    | body exceeds 256 KiB                                        |
| 415  | `unsupported_media_type` | body without `Content-Type: application/json`             |
| 500  | `internal_error`       | unexpected server error                                     |
| 500  | `content_parse_error`  | corrupted seeded content                                    |

### CORS

`Access-Control-Allow-Origin` is configurable via `API_CORS_ORIGIN` (default `*`).
Allowed methods: `GET, POST, PUT, DELETE, OPTIONS`. Allowed headers: `content-type, idempotency-key`.
`OPTIONS` preflights return `204` and are cached for 600s.

### Idempotency

All mutations require an `idempotencyKey` (non-empty string, max 200 chars) in the JSON body,
except `DELETE .../progress` which takes it via the `Idempotency-Key` header. Replaying a key with
the same payload returns the original result; with a different payload it returns `409 idempotency_conflict`.

### Path parameters

- `learnerId`: non-empty, max 128 chars
- `missionId` / `flashcardId`: URL-encoded, non-empty, max 128 chars

---

## GET /api/v1/health

Liveness check; verifies the database connection.

Response `data`:

```json
{ "status": "ok", "database": "ok" }
```

## GET /api/v1/catalog

Query params:

- `include` (optional): comma-separated subset of `missions,awards`. Omitted/empty returns both.
  Unknown values return `400 validation_error`.

Response `data` (`CatalogDto`), with `meta.etag` set to `"cv-<contentVersion>"`:

```json
{
  "contentVersion": "24-char hash of visible content",
  "missions": [
    {
      "id": "mission-id",
      "title": "string",
      "difficulty": "beginner | intermediate | advanced",
      "levelTrack": "beginner | basic_understanding | applied_practice | responsible_use | builder_mindset",
      "trackOrder": 1,
      "objective": "string",
      "prerequisiteMissionId": "optional",
      "estimatedMinutes": 10,
      "contentVersion": 1
    }
  ],
  "awards": [
    {
      "id": "award-id",
      "kind": "badge | milestone",
      "name": "string",
      "icon": "string",
      "description": "string",
      "missionId": "optional",
      "rule": { "type": "mission_completed | track_completed | score_threshold | streak | percent_complete" }
    }
  ]
}
```

Award `rule` variants:

- `{ "type": "mission_completed", "missionId": "..." }`
- `{ "type": "track_completed", "levelTrack": "..." }`
- `{ "type": "score_threshold", "minScorePercent": 90, "missionId": "optional" }`
- `{ "type": "streak", "length": 3 }`
- `{ "type": "percent_complete", "minPercent": 50 }`

## GET /api/v1/missions/:missionId

Returns full mission content. `404 not_found` if the mission does not exist or is not published.

Response `data` (`MissionDetailDto`):

```json
{
  "mission": {
    "...": "all MissionSummary fields from /catalog",
    "lesson": [
      { "type": "paragraph", "text": "..." },
      { "type": "list", "items": ["..."] },
      { "type": "callout", "tone": "key_idea | watch_out", "title": "optional", "text": "..." },
      { "type": "key_term", "term": "...", "flashcardId": "..." }
    ],
    "example": { "type": "worked_example | scenario" },
    "checkpoint": { "kind": "single_question | write_response | sort_into_buckets | spot_the_problem" },
    "questions": [
      {
        "id": "question-id",
        "missionId": "mission-id",
        "type": "multiple_choice | true_false | scenario",
        "stem": "string",
        "selectionMode": "single | multiple",
        "options": [{ "id": "opt-id", "text": "...", "isCorrect": true, "incorrectReason": "optional" }],
        "correctExplanation": "string",
        "incorrectExplanation": "string",
        "conceptTags": ["tag"],
        "scenario": "scenario type only",
        "allowsReasoning": "scenario type only"
      }
    ],
    "flashcards": [
      {
        "id": "flashcard-id",
        "missionId": "mission-id",
        "concept": "string",
        "definition": "string",
        "example": "string",
        "commonMistake": "optional",
        "learningTip": "optional",
        "conceptTags": ["tag"]
      }
    ],
    "awards": ["AwardDefinition, same shape as /catalog"],
    "passThreshold": 70
  }
}
```

## GET /api/v1/learners/:learnerId/progress

Returns the learner's full progress snapshot (`ProgressSnapshotDto`, see shape below).
Unknown learners return an empty snapshot, never `404`.

## PUT /api/v1/learners/:learnerId/missions/:missionId/progress

Records mission step progress. Request body (`UpdateMissionProgressRequest`):

```json
{
  "idempotencyKey": "string (required, max 200)",
  "furthestStep": "lesson | example | checkpoint | quiz | result (required)",
  "checkpointCompleted": "boolean (optional)",
  "completed": "boolean (optional)",
  "occurredAt": "ISO-8601 date-time (required)"
}
```

Response `data` (`ProgressMutationDto`):

```json
{
  "snapshot": { "ProgressSnapshot": "see below" },
  "newlyEarnedAwards": ["award-id"]
}
```

## POST /api/v1/learners/:learnerId/quiz-attempts

Records a graded quiz attempt. Request body (`RecordQuizAttemptRequest`):

```json
{
  "idempotencyKey": "string (required, max 200)",
  "attempt": {
    "id": "client-generated attempt id (required, max 128)",
    "missionId": "string (required)",
    "contentVersion": "integer (required)",
    "answers": [
      {
        "questionId": "string (required)",
        "selectedOptionIds": ["string"],
        "reasoning": "string (optional, max 2000)"
      }
    ],
    "startedAt": "ISO-8601 date-time (required)",
    "completedAt": "ISO-8601 date-time (required)"
  },
  "completionCandidate": "boolean (optional, default false)",
  "awardCandidateIds": ["string (optional, default [])"]
}
```

Validation: answers must be non-empty, reference known questions of the mission without duplicates,
and only select known option ids; otherwise `400 validation_error`. An attempt `id` already recorded
for a different learner returns `409 attempt_conflict`.

Response `data` (`QuizAttemptMutationDto`):

```json
{
  "snapshot": { "ProgressSnapshot": "see below" },
  "newlyEarnedAwards": ["award-id"],
  "attempt": {
    "id": "string",
    "missionId": "string",
    "contentVersion": 1,
    "answers": [
      {
        "questionId": "string",
        "selectedOptionIds": ["string"],
        "reasoning": "optional",
        "isCorrect": true,
        "conceptTags": ["tag"]
      }
    ],
    "scorePercent": 80,
    "correctCount": 4,
    "questionCount": 5,
    "result": "passed | needs_review",
    "weakTopics": ["tag"],
    "startedAt": "ISO-8601",
    "completedAt": "ISO-8601"
  }
}
```

## PUT /api/v1/learners/:learnerId/flashcards/:flashcardId/rating

Rates a flashcard. `404 not_found` for unknown flashcards. Request body (`RateFlashcardRequest`):

```json
{
  "idempotencyKey": "string (required, max 200)",
  "rating": "got_it | needs_work (required)",
  "occurredAt": "ISO-8601 date-time (required)"
}
```

Response `data` (`FlashcardRatingMutationDto`):

```json
{
  "flashcardId": "string",
  "rating": "got_it | needs_work",
  "reviewCount": 3,
  "updatedAt": "ISO-8601",
  "weakTopics": [{ "topic": "tag", "weight": 2, "sources": ["question-id"] }]
}
```

## POST /api/v1/learners/:learnerId/progress/import

Replaces the learner's progress from a portable snapshot. Request body (`ImportProgressRequest`):

```json
{
  "idempotencyKey": "string (required, max 200)",
  "mode": "replace (required, only supported value)",
  "snapshot": { "PortableProgressSnapshot": "see below" }
}
```

Response `data` is the resulting `ProgressSnapshotDto`.

## DELETE /api/v1/learners/:learnerId/progress

Resets all progress for the learner. Requires the `Idempotency-Key` header (non-empty, max 200 chars);
no request body. Response `data` is the resulting empty `ProgressSnapshotDto`.

---

## Shared shapes

`ProgressSnapshotDto` / `PortableProgressSnapshot`:

```json
{
  "learnerId": "string (snapshot only)",
  "schemaVersion": 1,
  "revision": "ISO-8601 (snapshot only)",
  "exportedAt": "ISO-8601 (portable snapshot only)",
  "missions": {
    "mission-id": {
      "missionId": "mission-id",
      "status": "not_started | in_progress | completed",
      "furthestStep": "lesson | example | checkpoint | quiz | result",
      "checkpointCompleted": false,
      "startedAt": "ISO-8601 (optional)",
      "completedAt": "ISO-8601 (optional)"
    }
  },
  "attempts": ["QuizAttempt, same shape as quiz-attempts response"],
  "flashcardRatings": {
    "flashcard-id": { "rating": "got_it | needs_work", "reviewCount": 1, "updatedAt": "ISO-8601" }
  },
  "earnedAwards": [{ "awardId": "award-id", "earnedAt": "ISO-8601" }]
}
```
