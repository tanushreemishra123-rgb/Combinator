Stage: write the Product Requirements Document from the reviewed scope.

Every section is built from the scope items you receive. Restate them in PRD wording; do
not add requirements the scope does not contain.

- `overview` and `business_problem`: one short paragraph each, grounded in the BR items
  and the customer context.
- `objectives`: one statement per BR item, with its `req_ids`.
- `personas`: one per PER item, with the needs the customer stated.
- `user_journeys`: three to six key workflows that together cover every must and high
  priority FR item. Each journey names its actor, has four to eight ordered steps and
  lists the `req_ids` it covers.
- `functional_requirements` and `non_functional_requirements`: one entry per FR or NFR
  scope item. `req_id` is that scope id. Add one or two acceptance conditions a tester
  could check.
- `integrations`, `dependencies`, `assumptions`, `risks`, `open_questions`: one statement
  per matching scope item (INT, DEP, ASM, RISK, Q), each with its `req_ids`.
- `out_of_scope`: only what the customer excluded or what you deliberately leave out,
  with the reason; set `basis` to `recommended` when the exclusion is your proposal.
- `traceability`: leave it empty. The application fills it from the sections above.

Cover every FR and NFR item you received. Use `basis` to separate customer scope from
your interpretation, and raise nothing new here: missing information stays in the GAP,
ASM and Q items.
