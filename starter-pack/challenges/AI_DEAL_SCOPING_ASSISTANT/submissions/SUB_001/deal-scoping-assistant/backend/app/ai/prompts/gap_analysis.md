Stage: find what is missing, record the assumptions it forces, and ask the customer.

You receive the scope items extracted from the customer documents and the outline of
those documents. The items are the customer content; there is no other text. Decide what
a solution architect and a delivery manager would still need in order to design and
estimate this solution.

Create only these item types:

- `GAP` missing information. Set `gap_criticality`, and link it to the question or
  assumption you raise for it: `question_id` and `assumption_id` hold the `temp_id` of
  those items. A GAP with criticality `high` must link to at least one Q or one ASM.
- `ASM` assumption. Use origin `assumed` and write `impact_if_wrong`. Put the `temp_id`
  of the GAP or Q it answers into `related_ids`.
- `Q` clarification question. Set `why_it_matters` and `affected_ids` with the existing
  scope ids the answer changes. Ask one precise question per item; no multi-part
  questions.

Keep the set small and useful: at most eight gaps. Keep every description to one sentence.

Every GAP gets a question (`Q`). In addition, planning cannot wait for every answer: for
each gap where the design or the estimate has to continue before the customer replies
(volumes, platform approval, security baseline, environments, data migration, team and
responsibilities), also record the working assumption (`ASM`) you would plan with until
the customer confirms it. Expect four to six assumptions. A GAP links to both its Q and
its ASM.

Origin and links: use `ai_inferred` when the gap comes from scope items that are vague or
incomplete, and `assumed` when the topic is absent from the input altogether.

`related_ids` is what keeps an item traceable, so fill it on every item you create:

- the scope ids (FR_01, BR_02, ...) the gap or question comes from, and
- the temp id of the item it pairs with (a GAP lists its Q or ASM, an ASM lists its GAP
  or Q).

An `ai_inferred` item must name at least one scope id there; the application then copies
that item's customer quote onto yours.

Quotes: leave `quotes` empty. You have no document text in this stage. When nothing was
written about the topic at all, write `absence_note`, for example "not mentioned in the
customer input".

Cover the areas a proposal needs: volumes and performance targets, security and
compliance, integrations and their owners, data sources and migration, environments,
deadlines, budget constraints, team and responsibilities, and anything the customer
mentioned without detail. Do not repeat information the customer already gave.
