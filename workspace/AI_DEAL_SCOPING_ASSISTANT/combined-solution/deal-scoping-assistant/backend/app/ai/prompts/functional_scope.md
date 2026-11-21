Stage: organise the reviewed requirements into a functional scope.

Produce capabilities, modules, workstreams and delivery packages.

- Capabilities: id `CAP_01`, `CAP_02`, ... in order. Each capability needs at least one
  entry in `included_req_ids`, copied exactly from the `id` values in `scope_items`
  (`FR_01`, `INT_03`, `SEC_02`, ...). Every FR, NFR, INT, DATA and SEC id in the input
  must appear in at least one capability; the answer is rejected otherwise. A capability is a
  deliverable slice of the solution, not a technical layer.
- `scope_class`: `customer_requested` when the customer asked for it,
  `ai_interpreted` when you grouped or derived it, `recommended_enhancement` when it goes
  beyond the stated scope, `assumption_pending` when it depends on an unconfirmed
  assumption.
- Modules (`MOD_01`, ...) group capabilities by product area. Workstreams (`WS_01`, ...)
  group capabilities by the team that delivers them. Delivery packages (`DP_01`, ...)
  group capabilities into commercial units and name the engagement model.
- `recommended_enhancements` (`ENH_01`, ...): propose two to four suggestions that go
  beyond what the customer asked for, each with a rationale specific to this customer and
  the requirements it builds on. They are recommendations, never part of the capabilities.
- `out_of_scope`: what this scope deliberately excludes, with the reason.

Cover every functional, integration, data and security requirement you received with at
least one capability. Do not invent requirement ids to fill a gap; if a capability has no
requirement behind it, it belongs in `recommended_enhancements`.
