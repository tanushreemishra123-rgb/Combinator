/**
 * Deterministic estimate-input planner used by the mock AI provider. Like a live model it proposes
 * only workstreams, drivers, complexity, skills and notes - it never produces days, weeks or money.
 * Those come exclusively from calculateEstimate.
 */
import type { EstimateContext } from '../ai/types';
import { formatId, REQUIREMENT_KINDS } from '../domain';
import type { DriverSuggestion, EstimateSuggestion, WorkstreamSuggestion } from '../domain';
import { countOf, joinList } from './format';
import { comparePhaseIds, phaseName } from './phases';
import { distinct } from './scopeFacts';
import { planCapabilityWorkstreams } from './planner/capabilityDrivers';
import { reconcileCapabilityWorkstreams, securityModelFor } from './planner/doubleCounting';
import type { SecurityModel, SpecialisedDrivers } from './planner/doubleCounting';
import { createPlannerFacts } from './planner/facts';
import type { DriverSeed, PlannerFacts, WorkstreamSeed } from './planner/facts';
import { infrastructureDrivers } from './planner/infrastructureDrivers';
import { planNotes } from './planner/notes';
import { nonFunctionalDrivers, securityDrivers } from './planner/signalGroupDrivers';
import { AI_SKILLS, DATA_SKILLS, integrationSkills, platformSkills, securitySkills } from './planner/skills';
import { aiDrivers, dataDrivers, integrationDrivers } from './planner/strategyDrivers';

const NAME_COLLISION_SUFFIX = ' (Application Features)';

/**
 * Fixed workstreams; a workstream without drivers is omitted (e.g. no AI use cases -> no PH_4).
 * The generic security drivers are built only when no capability already delivers security work
 * (rule 3: security is either capability-driven or generic, never both - see doubleCounting.ts).
 */
function fixedWorkstreams(facts: PlannerFacts, specialised: SpecialisedDrivers, securityModel: SecurityModel): WorkstreamSeed[] {
  const security = securityModel === 'generic' ? securityDrivers(facts) : [];
  return [
    { name: 'Security and Compliance', phaseId: 'PH_2', drivers: security, skills: securitySkills() },
    {
      name: 'Cloud Infrastructure and Hardening',
      phaseId: 'PH_2',
      drivers: [...infrastructureDrivers(facts), ...nonFunctionalDrivers(facts)],
      skills: platformSkills(facts),
    },
    { name: 'System Integration', phaseId: 'PH_3', drivers: [...specialised.integration], skills: integrationSkills(facts) },
    { name: 'Data Platform and Migration', phaseId: 'PH_3', drivers: [...specialised.data], skills: [...DATA_SKILLS] },
    { name: 'AI Capabilities', phaseId: 'PH_4', drivers: [...specialised.ai], skills: [...AI_SKILLS] },
  ];
}

/** Capability workstreams take their names from the PRD; a clash with a fixed name is disambiguated. */
function withUniqueNames(capabilitySeeds: readonly WorkstreamSeed[], fixedSeeds: readonly WorkstreamSeed[]): WorkstreamSeed[] {
  const reserved = new Set(fixedSeeds.map((seed) => seed.name.toLowerCase()));
  return capabilitySeeds.map((seed) =>
    reserved.has(seed.name.toLowerCase()) ? { ...seed, name: `${seed.name}${NAME_COLLISION_SUFFIX}` } : seed,
  );
}

/** Scope ids cited by each design element a driver can reference (capability, component, integration, AI use case). */
function citedScopeIdsByElement(facts: PlannerFacts): ReadonlyMap<string, string[]> {
  const { capabilities, components, integrations, aiUseCases } = facts.context;
  return new Map<string, string[]>([
    ...capabilities.map((capability): [string, string[]] => [capability.id, capability.requirementIds]),
    ...components.map((component): [string, string[]] => [component.id, [...component.requirementIds, ...component.assumptionIds]]),
    ...integrations.map((spec): [string, string[]] => [spec.id, spec.requirementIds]),
    ...aiUseCases.map((useCase): [string, string[]] => [useCase.id, useCase.requirementIds]),
  ]);
}

/**
 * A workstream is justified by the reviewed scope items its drivers cite directly, plus the items
 * cited by the design elements those drivers build (e.g. the requirements behind each architecture
 * component of the infrastructure workstream). Requirements are listed before supporting items.
 */
function requirementIdsOf(drivers: readonly DriverSeed[], facts: PlannerFacts): string[] {
  const byElement = citedScopeIdsByElement(facts);
  const refIds = distinct(drivers.flatMap((driver) => driver.refIds));
  const reachable = distinct([...refIds, ...refIds.flatMap((id) => byElement.get(id) ?? [])]).filter((id) => facts.index.has(id));
  const isRequirement = (id: string): boolean => REQUIREMENT_KINDS.includes(facts.index.get(id)?.kind ?? 'risk');
  return [...reachable.filter(isRequirement), ...reachable.filter((id) => !isRequirement(id))];
}

/** Assigns WS_01.. and DRV_01.. in phase order so ids are stable for identical input. */
function numberWorkstreams(seeds: readonly WorkstreamSeed[], facts: PlannerFacts): WorkstreamSuggestion[] {
  let driverSequence = 0;
  return seeds.map((seed, index) => ({
    id: formatId('WS', index + 1),
    name: seed.name,
    phaseId: seed.phaseId,
    requirementIds: requirementIdsOf(seed.drivers, facts),
    drivers: seed.drivers.map((driver): DriverSuggestion => {
      driverSequence += 1;
      return { id: formatId('DRV', driverSequence), ...driver };
    }),
    skills: seed.skills,
  }));
}

/** Rule 3's chosen model, stated once so a reviewer sees why one of the two security workstreams is missing. */
function securityModelSentence(securityModel: SecurityModel): string {
  return securityModel === 'capability-led'
    ? 'Security and compliance work is delivered through the named security capability in the functional scope, so no separate generic security workstream is planned; that would price the same controls twice.'
    : 'No capability in the functional scope is dedicated to security, so security and compliance controls are estimated as their own workstream from the reviewed security-related requirements.';
}

function explain(facts: PlannerFacts, workstreams: readonly WorkstreamSuggestion[], securityModel: SecurityModel): string {
  const { customer } = facts.context;
  const subject = customer.opportunityName.trim() === '' ? 'this opportunity' : customer.opportunityName.trim();
  const driverCount = workstreams.reduce((total, workstream) => total + workstream.drivers.length, 0);
  const phases = distinct(workstreams.map((workstream) => workstream.phaseId)).map((id) => phaseName(id, id));
  const demanding = workstreams
    .flatMap((workstream) => workstream.drivers)
    .filter((driver) => driver.complexity === 'High' || driver.complexity === 'Very High')
    .map((driver) => `${driver.label} (${driver.id})`);
  const hotspots =
    demanding.length > 0
      ? `The main complexity hotspots are ${joinList(demanding)}.`
      : 'No driver is rated above Medium complexity.';
  return [
    `The estimate inputs for ${subject} are organised into ${countOf(workstreams.length, 'workstream')} and ${countOf(driverCount, 'scope driver')} across the build phases ${joinList(phases)}; Discovery and Architecture, Testing and Hardening, and Deployment and Handover are added as configurable overheads.`,
    'Each driver cites the reviewed requirements, capabilities, architecture components, integrations or AI use cases that justify it, and its complexity is derived from the facts named in its rationale.',
    'A capability whose reviewed requirements are all already priced by AI use-case, integration or data drivers is priced once, in those more specific workstreams, never twice; two capabilities built from the same requirements are combined into one driver.',
    hotspots,
    securityModelSentence(securityModel),
    'Only complexity levels are suggested here: effort, timeline and ROM values are calculated from the base-effort table, role mix, day rates, contingency and team size in the estimation configuration.',
  ].join(' ');
}

export function planEstimateInputs(context: EstimateContext): EstimateSuggestion {
  const facts = createPlannerFacts(context);
  const capabilityPlan = planCapabilityWorkstreams(facts);
  const specialised: SpecialisedDrivers = { ai: aiDrivers(facts), integration: integrationDrivers(facts), data: dataDrivers(facts) };
  const securityModel = securityModelFor(capabilityPlan.workstreams);
  const fixed = fixedWorkstreams(facts, specialised, securityModel);
  const capabilityWorkstreams = reconcileCapabilityWorkstreams(capabilityPlan.workstreams, specialised, facts);
  const seeds = [...withUniqueNames(capabilityWorkstreams, fixed), ...fixed]
    .filter((seed) => seed.drivers.length > 0)
    .sort((a, b) => comparePhaseIds(a.phaseId, b.phaseId));
  const workstreams = numberWorkstreams(seeds, facts);
  return { workstreams, ...planNotes(facts, capabilityPlan), explanation: explain(facts, workstreams, securityModel) };
}
