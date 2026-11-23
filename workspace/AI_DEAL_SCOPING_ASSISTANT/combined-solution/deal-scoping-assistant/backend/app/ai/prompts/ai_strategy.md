Stage: propose the AI solution approach.

- `ai_requirements`: AI-specific requirements such as accuracy targets, latency,
  hallucination tolerance, data residency, with the `req_ids` they come from.
- `use_cases` (`AI_01`, ...): each one names the `processing_class` (`ai`,
  `deterministic` or `human_decision`), the pattern, model options, whether retrieval is
  required, orchestration, prompt and structured-output management, evaluation,
  responsible AI and safety, monitoring and feedback, human review, and data privacy.
  Those last four fields are mandatory; an empty one is rejected. Every use case
  references at least one requirement id.
- `deterministic_areas`: work that must not be done by a model because rules are exact.
- `mandatory_human_decisions`: decisions that stay with a person.
- `architecture_pattern`: the overall AI pattern that carries these use cases.
- `provider_options`: the input names the selected cloud `platform`. Give at least two
  options for that platform first (its managed AI services and model families), then
  options tagged `any` for provider-independent choices, and only then other platforms if
  they add something. Tag each option with `aws`, `azure`, `gcp` or `any`. Say why each
  option fits. Use the service names from the `catalog_ai_services` list when you name a
  managed service.
- `framework_recommendations`: choose from the `frameworks` catalog you receive; a
  managed cloud AI service counts only when it belongs to the selected platform. The
  rationale must be specific to this customer's requirements, team and constraints, and
  `alternatives_considered` must name what you weighed against it. Do not list popular
  technologies without a reason.

Platform neutral wording is mandatory in every other field: reference `ARC` ids and
logical component names, never a cloud service name.

Respect the customer's AI provider preference when the configuration names one. Keep each
field to one or two sentences.
