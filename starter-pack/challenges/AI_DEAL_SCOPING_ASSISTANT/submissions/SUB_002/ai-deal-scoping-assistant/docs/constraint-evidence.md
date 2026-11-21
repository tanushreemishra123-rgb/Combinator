# Constraint evidence map

Every **Constraints** bullet of the challenge specification, the code that enforces it, and the test
that proves it. Paths are relative to the repository root; run any test with
`npx vitest run <path>`.

## 1. Customer requirements analysis

| Constraint | Enforced by | Proven by |
| --- | --- | --- |
| "Each extracted requirement must retain a reference to the originating customer text and be classified as customer-stated, AI-inferred, or assumed." | `groundScopeItems` (`src/analysis/grounding.ts`) locates every quote in the normalized document, fills in its section and line range, and **downgrades** a claim it cannot locate from customer-stated to AI-inferred with `verified: false`. `canBeCustomerStated` (`src/scope/model.ts`) stops a reviewer relabelling a sourceless item as customer-stated. | `src/analysis/grounding.test.ts` ("verifies an exact quote and fills section and line references", "overwrites line references supplied by the model with the located ones"); `src/scope/model.test.ts`; `src/seed/mockResponses/mockResponses.test.ts` ("captures every numbered customer statement of the source text, so nothing the customer wrote is silently dropped"). |
| "Missing or ambiguous critical information must be surfaced through assumptions or clarification questions rather than silently invented." | `raiseChecklistGaps` (`src/analysis/gaps.ts`) turns each unanswered checklist item (`gapChecklist.data.ts`) into a `GAP_xx` plus a paired `Q_xx`, and `raiseIntegrationReadinessGaps` does the same for an integration whose readiness the text never states; `planAnalysis` (`src/analysis/heuristicAnalyzer.ts`) raises an assumption instead of a fact when a statement carries an uncertainty cue. Validators drop, never invent, references: `validatePrdOutput`, `validateArchitectureOutput`, `validateDataIntegration`, `validateAiSolution`. | `src/analysis/gaps.test.ts`; `src/analysis/heuristicAnalyzer.test.ts`; `src/strategy/validate.test.ts` ("flags an integration that cites no reviewed requirement as an unsupported recommendation"). |

## 2. PRD and functional scope

| Constraint | Enforced by | Proven by |
| --- | --- | --- |
| "Every major capability or functional-scope item must reference one or more reviewed requirement IDs." | `buildCapabilities` (`src/prd/capabilities.ts`) builds every capability from the requirement ids it cites; `validatePrdOutput` (`src/prd/validate.ts`) removes ids that are not in the approved in-scope model and records a warning. | `src/prd/capabilities.test.ts`; `src/prd/validate.test.ts` ("removes an unknown requirement id from a capability and raises an unknown-reference warning"). |
| "The application must identify uncovered requirements and unsupported scope additions without requiring the reviewer to manually compare the complete documents." | `buildCoverageReport` (`src/traceability/coverage.ts`) computes requirement-side coverage and the output-side list of elements citing nothing or unknown ids; the quality checks `uncoveredRequirements`, `highPriorityCoverage` and `unsupportedAdditions` (`src/quality/checks/`) grade it before export. | `src/traceability/coverage.test.ts`; `src/quality/checks/uncoveredRequirements.test.ts` ("warns for every requirement no generated element cites, regardless of priority"). |

## 3. Cloud solution architecture

| Constraint | Enforced by | Proven by |
| --- | --- | --- |
| "The architecture must use services specific to the selected cloud platform and must not be limited to a generic list of technologies." | Every logical component resolves its service from the per-platform catalog (`src/architecture/catalog/cloudServiceCatalog.data.ts`); `validateArchitectureOutput` (`src/architecture/validate.ts`) rejects a service that belongs to another platform and re-resolves it from the selected catalog. | `src/architecture/validate.test.ts`; `src/architecture/catalog/cloudServiceCatalog.test.ts`; `src/test/pipeline.e2e.test.ts` runs all four seeds and asserts the services differ per platform. |
| "Every major architecture component must reference a customer requirement, non-functional requirement, security need, or reviewed assumption that justifies it." | Foundation and conditional rules (`src/architecture/componentRules.data.ts`) only emit a component when a citable scope item of the required kind triggers it; `validateArchitectureOutput` drops unknown ids; the `unjustifiedComponents` quality check fails the gate if any component is left uncited. | `src/architecture/planner.test.ts`; `src/quality/checks/unjustifiedComponents.test.ts` ("fails when a component cites no reviewed requirement or assumption"). |

## 4. Data, integration and AI strategy

| Constraint | Enforced by | Proven by |
| --- | --- | --- |
| "Every major integration and AI use case must reference relevant reviewed requirements and appear in the corresponding solution design or coverage view." | `buildIntegrations` (`src/strategy/integrations.ts`) and `buildAiUseCases` (`src/strategy/aiUseCases.ts`) derive each entry from the scope items that trigger it; `collectElements` (`src/traceability/elements.ts`) puts both into the coverage view; `integrationsMissingFromPlan` and `aiUseCaseSafeguards` (`src/quality/checks/`) check they reach the delivery plan and carry evaluation, privacy, safety and human-review notes. | `src/strategy/integrations.test.ts`; `src/strategy/aiUseCases.test.ts`; `src/quality/checks/integrationsMissingFromPlan.test.ts`; `src/quality/checks/aiUseCaseSafeguards.test.ts`. |
| "Framework and service recommendations must include a solution-specific rationale and distinguish AI functions from deterministic rules and mandatory human decisions." | `buildFrameworkRecommendations` (`src/strategy/aiFrameworks.ts`) writes each rationale from the requirement ids and the use-case pattern it is recommended for; `buildProcessingBoundaries` (`src/strategy/aiBoundaries.ts`) classifies every activity as AI, deterministic rule or mandatory human decision, reading the customer's own wording for human decisions. | `src/strategy/aiFrameworks.test.ts`; `src/strategy/aiBoundaries.test.ts` ("gives a payment activity and a search activity different, activity-specific reasons"; human-decision rationale suite). |

## 5. Effort, timeline and ROM commercials

| Constraint | Enforced by | Proven by |
| --- | --- | --- |
| "Effort, timeline, and ROM values must be reproducible from visible scope factors, rates, assumptions, contingency, currency, or documented calculation rules." | `calculateEstimate` (`src/estimation/engine/calculateEstimate.ts`) is a pure function over the driver table, the base-effort table, the role mix, the rate card, contingency and currency; `snapshotConfig` stamps the exact inputs used; every rule is documented as `CR_01`-`CR_15` and printed with the estimate. The AI schema carries no effort or money field. | `src/estimation/engine/calculateEstimate.test.ts` ("sizes drivers from the base-effort table and sums them", "splits likely effort across roles so that role days add up exactly"); `src/test/pipeline.e2e.test.ts` asserts the same inputs reproduce the same totals. |
| "Missing estimation inputs must reduce confidence or block the affected calculation rather than being silently replaced with unsupported values." | `detectMissingInputs` (`src/estimation/missingInputs.ts`) reports every unknown input, the components it affects and how to resolve it, and lowers confidence; a null rate blocks the ROM instead of defaulting; `updateEstimationConfig` (`src/state/useCases/config.ts`) validates the merged configuration and rejects values such as team size 0; blank inputs in the UI keep the last valid value instead of silently becoming a number. | `src/estimation/missingInputs.test.ts`; `src/estimation/missingInputs.e2e.test.ts`; `src/ui/estimate/inputs/CommercialConfigCard.test.tsx`; `src/state/useCases/config.test.ts`. |

## 6. Integrated scoping package

| Constraint | Enforced by | Proven by |
| --- | --- | --- |
| "Users must be able to modify at least one reviewed requirement or major assumption and see which scope, architecture, strategy, effort, or commercial outputs are affected." | Ten change types (`src/impact/changes/`) feed `analyzeImpact` (`src/impact/analyzeImpact.ts`), which lists affected and unaffected areas with reasons; `applyImpactReport` marks only the stages that own an affected section stale and keeps every other stage **by reference**, so reviewed content is never silently replaced. | `src/impact/applyImpact.test.ts` ("marks only the stage that owns an affected section stale, with a readable reason"; "leaves every stage that owns no affected section untouched by reference"); `src/impact/changes/*.test.ts`. |
| "The final package must identify uncovered requirements, unresolved questions, unsupported recommendations, estimation gaps, inconsistencies, and items requiring human validation before export." | `runQualityGate` (`src/quality/index.ts`) runs its checks (`src/quality/checks/`) and `rollUpExportStatus` turns them into Ready / Review required / Blocked, which `buildPackage` stamps into every export next to the mandatory disclaimer. | `src/quality/**/*.test.ts`; `src/export/packageBuilder/qualityReview.test.ts`; `src/export/markdown.test.ts`, `html.test.ts`, `docx/*.test.ts` and `workspaceJson.test.ts` assert the disclaimer in every format. |

## Solution-depth requirements

| Requirement | Where it lives |
| --- | --- |
| Structured, reviewable scope model | `src/scope` (`createScopeModel`, `updateScopeItem`, `approveScope`), reviewed in the requirements workspace. |
| Source traceability at requirement level | `src/analysis/grounding.ts` + `SourceRef` on every item; source chips open the highlighted customer text. |
| User review before downstream generation | `approveScope` throws while any item is pending; `stagePrerequisite` (`src/state/stageRules.ts`) blocks every later stage until the scope is approved. |
| Multiple connected deliverables | `src/prd`, `src/architecture`, `src/strategy`, `src/estimation`, all reading the same reviewed scope model. |
| Requirement-to-output traceability | `src/traceability` (`buildTraceLinks`, `buildCoverageReport`). |
| Explainable, reproducible estimation | `src/estimation/engine` with per-workstream calculation steps and rules `CR_01`-`CR_15`. |
| Change-impact handling | `src/impact`. |
| Cross-document coverage and consistency validation | `src/traceability` + `src/quality/checks`. |
| Pre-export quality gate | `runQualityGate` and the export status banner. |
