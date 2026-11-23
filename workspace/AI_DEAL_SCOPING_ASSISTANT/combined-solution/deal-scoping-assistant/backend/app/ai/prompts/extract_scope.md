Stage: extract the structured scope model from the customer documents.

You receive `documents` with their segments in full. Be exhaustive and work through the
segments in order: every objective, persona, requirement, existing system, integration,
data need, security expectation, technology preference, constraint, dependency and risk
stated there must appear as an item. Do not stop before the last segment. One item is one
statement; do not merge two requirements into one item and do not split a sentence into
near-duplicates.

Personas: create one PER item for every distinct group that uses or operates the solution
(for example customers, agents, back-office staff, administrators, support, auditors),
quoting the segment that mentions that group.

Item types (use the `type` value): BR business objective, PER persona, FR functional
requirement, NFR non-functional requirement, SYS existing system, INT integration, DATA
data requirement, SEC security or compliance expectation, TECH technology preference,
CON delivery constraint, DEP dependency, RISK risk.

Do not create GAP, ASM or Q items in this stage. A later stage handles missing
information, assumptions and clarification questions.

Identifiers: give every item a `temp_id` such as `t1`, `t2`. The application replaces
them with final ids (BR_01, FR_01, ...). Reference other items of this answer by their
`temp_id` in `related_ids`.

Quotes are mandatory for every item. Each entry of `quotes` has:

- `segment_id`: the id of the segment the item comes from.
- `quote`: the customer text copied from that segment character for character. Do not
  shorten with "...", do not fix spelling, do not translate. Quote one sentence or a
  short passage.

Origin: `customer_stated` when the segment states it directly; `ai_inferred` when you
read it between the lines of a quoted segment. Never use `assumed` in this stage.
Customer text rarely spells out everything a solution needs. Where a quoted segment
implies a requirement without stating it (a portal implies authentication and monitoring,
GDPR implies data retention and subject-access handling, a batch window implies job
scheduling and alerting), add that item with origin `ai_inferred` and the quote that
implies it. A typical document yields a few such items; never label an inferred item as
customer stated.

Priority: `must` and `high` only when the customer's own wording asks for it (must,
required, mandatory, deadline), otherwise `medium` or `low`.

Type fields: an NFR item sets `nfr_category`; an INT item sets `integration_system`,
`integration_direction` and `integration_pattern`. Leave the other type fields empty.

Tags help later stages. Use only these when they apply: scalability, performance,
security, compliance, data, integration, ai, ux, migration, observability, reporting.

Be brief, the whole scope is one answer: `title` is a short phrase and `description` is
one sentence that adds what the quote does not already say. Never repeat the quote as the
description.
