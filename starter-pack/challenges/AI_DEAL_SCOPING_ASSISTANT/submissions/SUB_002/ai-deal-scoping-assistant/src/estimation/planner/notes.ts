/**
 * Delivery risks, dependencies, assumptions and exclusions of the estimate. They are derived from
 * the reviewed RSK / DEP / ASM items and open questions, plus the standard scoping exclusions of a
 * ROM. Texts deliberately contain no effort, duration or cost figures.
 */
import { formatId, REQUIREMENT_KINDS } from '../../domain';
import type { EstimateNote, EstimateSuggestion, ScopeItem } from '../../domain';
import { formatWhole, joinList } from '../format';
import { describeItem, itemsOfKind } from '../scopeFacts';
import type { CapabilityPlan } from './capabilityDrivers';
import { activeIds, citeIds } from './facts';
import type { PlannerFacts } from './facts';

interface NoteDraft {
  text: string;
  refs: string[];
}

export type PlannedNotes = Pick<EstimateSuggestion, 'risks' | 'dependencies' | 'assumptions' | 'exclusions'>;

function numbered(prefix: string, drafts: readonly NoteDraft[]): EstimateNote[] {
  return drafts.map((draft, index) => ({ id: formatId(prefix, index + 1), text: draft.text, refs: draft.refs }));
}

/** ' It is scoped against FR_02 and FR_03.' - only when the item names other reviewed items. */
function relatedClause(related: readonly string[]): string {
  return related.length > 0 ? ` It is scoped against ${citeIds(related)}.` : '';
}

/**
 * A reviewed RSK_/DEP_/ASM_ item is already described in full in the PRD; restating its title and
 * description here would only double the row count. Instead
 * each note states the one thing that is specific to the *estimate*: how that item is priced (or
 * deliberately not priced) so a reviewer can see it was considered without reading it twice.
 */
function riskEstimationNote(item: ScopeItem, facts: PlannerFacts): NoteDraft {
  const related = activeIds(item.relatedIds, facts);
  return {
    text: `${item.id} is not priced as its own effort line; the estimate carries it through the workstream confidence rating instead of a dedicated cost, and the affected driver(s) must be revisited if it materialises.${relatedClause(related)}`,
    refs: [item.id, ...related],
  };
}

function dependencyEstimationNote(item: ScopeItem, facts: PlannerFacts): NoteDraft {
  const related = activeIds(item.relatedIds, facts);
  return {
    text: `${item.id} is treated as a precondition the estimate assumes will be met on schedule, not as a costed activity; a delay pushes out the dependent work rather than adding effort, so while it is outstanding the workstreams whose requirements it relates to are held at Medium confidence at most.${relatedClause(related)}`,
    refs: [item.id, ...related],
  };
}

function assumptionEstimationNote(item: ScopeItem, facts: PlannerFacts): NoteDraft {
  const related = activeIds(item.relatedIds, facts);
  const status = item.resolved ? 'confirmed by the reviewer' : 'still to be validated with the customer';
  return {
    text: `The estimate is built as if ${item.id} holds as stated (${status}); if that turns out to be wrong, the driver(s) it affects must be re-scored on the next calculation.${relatedClause(related)}`,
    refs: [item.id, ...related],
  };
}

function planRisks(facts: PlannerFacts): NoteDraft[] {
  const { integrations, aiUseCases } = facts.context;
  const unconfirmed = integrations
    .filter((spec) => spec.readiness !== 'confirmed')
    .map((spec) => ({
      text: `Interface readiness of ${spec.system} (${spec.id} ${spec.name}) is not confirmed; late sandbox access or interface changes would extend the integration workstream.`,
      refs: [spec.id, ...activeIds(spec.requirementIds, facts)],
    }));
  const critical = facts.active
    .filter((item) => (item.kind === 'gap' || item.kind === 'question') && item.critical && !item.resolved)
    .map((item) => ({
      text: `Critical open item ${describeItem(item)} is unresolved; the estimate components it affects stay at Low confidence until it is closed.`,
      refs: [item.id],
    }));
  const ai =
    aiUseCases.length === 0
      ? []
      : [
          {
            text: `AI output quality for ${joinList(aiUseCases.map((useCase) => useCase.name))} depends on representative customer data being available for evaluation; acceptance thresholds must be agreed before the AI build starts.`,
            refs: aiUseCases.map((useCase) => useCase.id),
          },
        ];
  const scopeChange = {
    text: 'Requirement detail that emerges during Discovery and Architecture may change driver complexity; the estimate must be recalculated after each reviewed scope change so the ROM stays aligned.',
    refs: [],
  };
  return [
    ...itemsOfKind(facts.active, 'risk').map((item) => riskEstimationNote(item, facts)),
    ...unconfirmed,
    ...critical,
    ...ai,
    scopeChange,
  ];
}

function planDependencies(facts: PlannerFacts): NoteDraft[] {
  const systems = itemsOfKind(facts.active, 'existingSystem').map((item) => ({
    text: `Access to a test instance of ${item.title} (${item.id}) and a named subject-matter expert while the related integration and data work is delivered.`,
    refs: [item.id],
  }));
  const questions = itemsOfKind(facts.active, 'question').filter((item) => !item.resolved);
  const decisions =
    questions.length === 0
      ? []
      : [
          {
            text: `Customer answers to the open questions (${joinList(questions.map((item) => item.id))}) before Discovery and Architecture completes.`,
            refs: questions.map((item) => item.id),
          },
        ];
  const platform = {
    text: `Accounts, subscriptions and delivery-team access on ${facts.platformLabel} are provisioned by the customer before the build phases start.`,
    refs: [],
  };
  return [
    ...itemsOfKind(facts.active, 'dependency').map((item) => dependencyEstimationNote(item, facts)),
    ...systems,
    ...decisions,
    platform,
  ];
}

function planAssumptions(facts: PlannerFacts): NoteDraft[] {
  const { environments } = facts.context.config;
  const reviewed = itemsOfKind(facts.active, 'assumption').map((item) => assumptionEstimationNote(item, facts));
  const environmentText =
    environments === null
      ? 'The number of environments is not confirmed; no environment uplift is applied until it is provided.'
      : `${formatWhole(environments)} environments are provisioned, as entered in the solution configuration.`;
  return [
    ...reviewed,
    { text: environmentText, refs: [] },
    { text: 'The customer provides timely access to subject-matter experts, environments and test data, and reviews deliverables within the agreed turnaround.', refs: [] },
    { text: 'One blended delivery team works across the build phases concurrently; the role mix per driver type is the configured one.', refs: [] },
  ];
}

function standardExclusions(facts: PlannerFacts): NoteDraft[] {
  const dataIds = itemsOfKind(facts.active, 'data').map((item) => item.id);
  const systems = itemsOfKind(facts.active, 'existingSystem');
  const listedData = dataIds.length > 0 ? ` (${joinList(dataIds)})` : '';
  const owners = systems.length > 0 ? ` (${joinList(systems.map((item) => item.title))})` : '';
  return [
    { text: 'Third-party software licences, subscriptions and cloud consumption charges are excluded; the ROM covers delivery services only.', refs: [] },
    { text: 'Hypercare, managed services and application support beyond the Deployment and Handover phase are excluded.', refs: [] },
    { text: `Migration of data or content that is not listed in the reviewed data requirements${listedData} is excluded.`, refs: dataIds },
    { text: `Changes to customer-owned or third-party systems${owners} that are needed to expose interfaces remain with the system owners.`, refs: systems.map((item) => item.id) },
    { text: 'Organisational change management, end-user training delivery and business process redesign are excluded beyond the handover documentation.', refs: [] },
    { text: 'Independent penetration testing and formal compliance certification audits are excluded; the estimate covers preparing the solution and its evidence for them.', refs: [] },
  ];
}

function planExclusions(facts: PlannerFacts, capabilityPlan: CapabilityPlan): NoteDraft[] {
  const outOfScope = facts.context.scope.items
    .filter((item) => REQUIREMENT_KINDS.includes(item.kind) && (!item.inScope || item.review === 'rejected'))
    .map((item) => ({ text: `${describeItem(item)} is out of scope or rejected in the reviewed scope model and is not estimated.`, refs: [] }));
  const enhancements = capabilityPlan.enhancements.map((capability) => ({
    text: `Recommended enhancement ${capability.id} ${capability.name} is not estimated until a reviewer accepts it into scope.`,
    refs: [capability.id],
  }));
  const inactive = capabilityPlan.withoutActiveScope.map((capability) => ({
    text: `Capability ${capability.id} ${capability.name} is not estimated because none of its requirements (${joinList(capability.requirementIds)}) is in the reviewed scope.`,
    refs: [capability.id],
  }));
  return [...standardExclusions(facts), ...outOfScope, ...enhancements, ...inactive];
}

export function planNotes(facts: PlannerFacts, capabilityPlan: CapabilityPlan): PlannedNotes {
  return {
    risks: numbered('ER', planRisks(facts)),
    dependencies: numbered('ED', planDependencies(facts)),
    assumptions: numbered('EA', planAssumptions(facts)),
    exclusions: numbered('EX', planExclusions(facts, capabilityPlan)),
  };
}
