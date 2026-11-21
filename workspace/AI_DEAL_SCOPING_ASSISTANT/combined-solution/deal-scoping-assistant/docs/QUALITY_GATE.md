# Quality gate

Sixteen deterministic checks run before export (`app/quality`). Each returns a
status (`passed`, `warning`, `failed`, `not_applicable`), the ids involved and a
plain remediation. Nothing here calls a model.

## Checks

| Id | What it checks | Severity | How to fix |
|---|---|---|---|
| QG_01 | Every must/high requirement is covered by a capability. | error | Add or extend a capability for the listed requirements. |
| QG_02 | Every approved FR/NFR/INT/DATA/SEC requirement is covered by a capability. | warning | Cover it, or mark it out of scope with a reason. |
| QG_03 | Capabilities, enhancements, components, integrations and AI use cases are grounded in an approved requirement. | warning | Link the element to a requirement or accept it as a labelled recommendation. |
| QG_04 | Every architecture component names a requirement or a non-rejected assumption. | error | Add the justifying ids, or remove the component. |
| QG_05 | Every integration sits in a workstream and every approved INT requirement has an integration. | error | Add the integration to a workstream, or design the missing one. |
| QG_06 | AI use cases document evaluation, data privacy, safety and human review. | warning | Fill the missing responsible-AI fields. |
| QG_07 | The estimate has all its inputs; blocked commercial lines fail. | error | Provide the missing input, or state the gap as an assumption. |
| QG_08 | Clarification questions are answered or dismissed; open questions on must/high items fail. | warning / error | Record the answer, or dismiss the question with a reason. |
| QG_09 | Cloud services exist in the selected platform catalog; technology and AI-provider preferences match the platform. | error | Map the component to a catalog service, or revisit the platform. |
| QG_10 | Workstream effort adds up, currency and rate card match, workstream ids exist, the config hash is current. | error | Recalculate the estimate against the current configuration. |
| QG_11 | No unconfirmed assumption and no element flagged for validation is used silently. | warning | Confirm or reject the assumption with the customer. |
| QG_12 | Every required artifact exists and is fresh. | error | Generate the missing artifacts, regenerate the stale ones. |
| QG_13 | Nine pairwise document checks (see below). | error | Regenerate the affected document, or correct the reference. |
| QG_14 | Every requirement tagged `ai` is answered by a use case, a deterministic area or a human decision, and every AI use case is grounded. | warning | Add the missing use case, area or decision. |
| QG_15 | Every approved FR/INT/DATA and AI-tagged requirement sits in a workstream. | warning | Assign it to a workstream or mark it out of scope. |
| QG_16 | Every approved FR/NFR/DATA/SEC/INT requirement is supported by an architecture component. | warning | Add or extend a component, or record why none is needed. |

## QG_13 pairs

Scope ↔ PRD · Scope ↔ Functional scope · Functional scope ↔ Architecture ·
Architecture ↔ Data strategy · Architecture ↔ Integration architecture ·
Architecture ↔ AI strategy · Functional scope ↔ Estimate ·
Integration ↔ Estimate · AI use cases ↔ Estimate.

A reference to an id that does not exist or was rejected fails the check; an
element nobody carries (a capability in no workstream, a requirement with no
component) warns. An AI use case with no AI or ML component fails when the use
case rests on a requirement, and warns when the AI only recommended it: the
architecture is designed first, so the reviewer accepts the recommendation and
regenerates the architecture, or rejects it.

## Summary and export status

The summary shows requirement coverage, uncovered requirements, unresolved
questions, unsupported recommendations, estimate confidence and the export
status:

| Status | When |
|---|---|
| `blocked` | A required artifact has not been generated, so the package cannot be assembled. |
| `review_required` | Any check warns or fails, or any artifact is stale. |
| `ready` | Everything passed and every artifact is fresh. |

Export with `review_required` is allowed; the findings are printed in the
package. The report also lists **items requiring human validation**: pending
assumptions the artifacts rely on, and elements flagged `validation_required`.
