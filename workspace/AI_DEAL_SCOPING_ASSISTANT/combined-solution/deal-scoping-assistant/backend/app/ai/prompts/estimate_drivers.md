Stage: describe what drives the delivery effort. You do not estimate it.

The application calculates effort, timeline and commercials from visible factors. Your
answer must contain no numbers about effort, cost, duration, dates, person-weeks,
person-days, rates, budget, team size or percentages. Writing any of them is an error.

Produce only:

- `units`: one per capability (`CAP`), integration (`IA`), AI use case (`AI`),
  architecture component (`ARC`) and data domain (`DOM`) you received. Set `unit_type`,
  the `workstream_id` it belongs to, a `complexity` of `low`, `medium`, `high` or
  `very_high`, and `drivers`: the concrete reasons for that complexity (number of
  systems, data volume, compliance, unknowns).
- `workstreams`: use the workstream ids of the functional scope. List the capability,
  integration, AI use case, architecture and data domain ids in each, the requirement
  ids behind them, a `derived_complexity`, the roles and skills needed, the delivery
  risks and the dependencies.
- `phases`: the delivery phases in order, the workstreams in each and the milestones
  that end them. Name milestones by outcome, never by date.
- `delivery_risks`, `estimation_assumptions` and `exclusions` (for example licences,
  cloud consumption, customer-side effort, third-party fees).

Roles are skill categories (for example Solution Architect, Backend Engineer, Data
Engineer, QA Engineer), never a number of people.
