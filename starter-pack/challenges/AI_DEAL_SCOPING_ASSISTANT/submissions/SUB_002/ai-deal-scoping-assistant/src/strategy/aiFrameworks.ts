/**
 * Framework/service recommendations (spec 4: "recommend appropriate frameworks... explain why...
 * not simply list popular technologies"). Each recommendation is chosen by a rule over the actual
 * use cases and any stated technology preference, cites the requirement ids that drove the choice,
 * and names the alternatives considered and why they were not picked.
 */
import type { AiUseCase, ArchitectureComponent, CloudPlatform, FrameworkRecommendation, ScopeItem } from '../domain';
import { AI_PATTERN_DEFS } from './aiPatterns.data';
import { findComponents, serviceNames } from './componentLookup';
import { platformLabel } from './dataTopics';
import { uniqueIds } from './shared';

function allRequirementIds(useCases: readonly AiUseCase[]): string[] {
  return uniqueIds(...useCases.map((useCase) => useCase.requirementIds));
}

/** True when any matched use case needs a stateful, looping agent workflow rather than one linear pass. */
function needsStatefulOrchestration(useCases: readonly AiUseCase[]): boolean {
  if (useCases.length > 1) {
    return true;
  }
  const single = useCases.at(0);
  if (single === undefined) {
    return false;
  }
  const def = AI_PATTERN_DEFS.find((candidate) => candidate.patternLabel === single.pattern);
  return def?.multiStep ?? true;
}

function orchestrationFramework(useCases: readonly AiUseCase[]): FrameworkRecommendation {
  const requirementIds = allRequirementIds(useCases);
  if (needsStatefulOrchestration(useCases)) {
    return {
      name: 'LangGraph',
      category: 'orchestration',
      rationale: `The reviewed AI scope (${requirementIds.join(', ')}) needs a stateful, multi-step workflow - retrieval/generation with a groundedness check, or several coordinated use cases - with an explicit human-in-the-loop checkpoint before a result is acted on; LangGraph models that as a graph of steps with durable state, which a single prompt call cannot provide.`,
      requirementIds,
      alternatives: [
        'A single prompt call per request (insufficient: it cannot hold state across the retrieve/draft/check steps or pause for human review).',
        'LangChain agents without a graph (workable, but its implicit control flow is harder to audit for the required human-checkpoint than an explicit LangGraph state machine).',
      ],
    };
  }
  return {
    name: 'Custom orchestration',
    category: 'orchestration',
    rationale: `The reviewed AI scope (${requirementIds.join(', ')}) is a single linear pipeline (parse/score, then a confidence-threshold branch); a lightweight custom orchestrator calling the model SDK directly delivers that without the operational overhead of a graph-based agent framework built for multi-step, looping workflows it does not need.`,
    requirementIds,
    alternatives: ['LangGraph (unnecessary state-machine and infrastructure overhead for a single linear pipeline with one threshold branch).'],
  };
}

const DOTNET_KEYWORDS = ['.net', 'c#', 'azure functions'];
const JAVA_KEYWORDS = ['java', 'spring'];

function techStackFrom(items: readonly ScopeItem[]): { framework: 'semantic-kernel' | 'spring-ai' | 'typescript'; matched: ScopeItem[] } {
  const techItems = items.filter((item) => item.kind === 'technology');
  const text = (item: ScopeItem) => `${item.title} ${item.description}`.toLowerCase();
  const dotnet = techItems.filter((item) => DOTNET_KEYWORDS.some((word) => text(item).includes(word)));
  if (dotnet.length > 0) {
    return { framework: 'semantic-kernel', matched: dotnet };
  }
  const java = techItems.filter((item) => JAVA_KEYWORDS.some((word) => text(item).includes(word)));
  if (java.length > 0) {
    return { framework: 'spring-ai', matched: java };
  }
  return { framework: 'typescript', matched: [] };
}

function frontEndFramework(items: readonly ScopeItem[], useCaseIds: readonly string[]): FrameworkRecommendation {
  const stack = techStackFrom(items);
  const evidenceIds = stack.matched.length > 0 ? stack.matched.map((item) => item.id) : useCaseIds;
  if (stack.framework === 'semantic-kernel') {
    return {
      name: 'Semantic Kernel',
      category: 'sdk',
      rationale: `The stated technology preference (${evidenceIds.join(', ')}) is .NET/Azure; Semantic Kernel is Microsoft's own orchestration SDK for that stack and integrates directly with Azure AI Foundry model deployments without a cross-language bridge.`,
      requirementIds: [...evidenceIds],
      alternatives: ['LangChain/LangGraph (Python/TypeScript-first; usable from .NET only through an extra service boundary the reviewed stack does not call for).'],
    };
  }
  if (stack.framework === 'spring-ai') {
    return {
      name: 'Spring AI',
      category: 'sdk',
      rationale: `The stated technology preference (${evidenceIds.join(', ')}) is Java/Spring; Spring AI gives the team the same dependency-injection and configuration model already used across the rest of the Spring application instead of introducing a second, unrelated runtime.`,
      requirementIds: [...evidenceIds],
      alternatives: ['LangChain (Python-first; would add a second runtime and deployment pipeline the Java stack does not need).'],
    };
  }
  return {
    name: 'Vercel AI SDK',
    category: 'sdk',
    rationale: `No .NET or Java preference is stated, so the front end streams model output using the same TypeScript stack as the rest of the application (${evidenceIds.join(', ')}); the Vercel AI SDK's streaming hooks remove the need to hand-roll server-sent-event/token-streaming handling in the UI.`,
    requirementIds: [...evidenceIds],
    alternatives: ['Mastra (a comparable TypeScript agent/streaming SDK; either is suitable, Vercel AI SDK is preferred for its more direct React streaming hooks).'],
  };
}

/** Short collective name for a platform's managed AI services, used instead of a raw comma-joined service list so trace links and tables stay readable. */
const MANAGED_AI_SERVICE_LABEL: ReadonlyMap<CloudPlatform, string> = new Map([
  ['aws', 'Amazon Bedrock managed AI services'],
  ['azure', 'Azure AI Foundry managed AI services'],
  ['gcp', 'Vertex AI managed AI services'],
]);

/** A single named service keeps its own name; several named together get one short collective label (the individual services stay in the rationale) instead of a raw comma-joined string used as an "id". */
function modelHostingName(platform: CloudPlatform, named: readonly string[]): string {
  if (named.length <= 1) {
    return named.at(0) ?? 'the platform-native managed AI service';
  }
  return MANAGED_AI_SERVICE_LABEL.get(platform) ?? 'the platform-native managed AI services';
}

function modelHostingFramework(platform: CloudPlatform, components: readonly ArchitectureComponent[], useCaseIds: readonly string[]): FrameworkRecommendation {
  const named = serviceNames(findComponents(components, { areas: ['ai-ml'] }));
  const serviceList = named.length > 0 ? named.join(', ') : 'the platform-native managed AI service';
  return {
    name: modelHostingName(platform, named),
    category: 'model-service',
    rationale: `Hosting the model(s) for ${useCaseIds.join(', ')} on ${serviceList} keeps inference inside the ${platformLabel(platform)} account boundary already used for the rest of the solution, avoiding a separate vendor contract, network egress path and access-control model to operate.`,
    requirementIds: [...useCaseIds],
    alternatives: ['A self-hosted open-weight model on Kubernetes/GPU nodes (higher operational overhead; only justified by a strict data-residency or cost-at-scale constraint the reviewed scope does not state).'],
  };
}

/** Solution-specific framework/service recommendations, each with a rationale citing requirement ids and named alternatives. */
export function buildFrameworkRecommendations(
  items: readonly ScopeItem[],
  useCases: readonly AiUseCase[],
  platform: CloudPlatform,
  components: readonly ArchitectureComponent[],
): FrameworkRecommendation[] {
  const useCaseIds = allRequirementIds(useCases);
  return [orchestrationFramework(useCases), frontEndFramework(items, useCaseIds), modelHostingFramework(platform, components, useCaseIds)];
}
