import type { AiUseCase, ArchitectureComponent, ScopeItem } from '../domain';
import { fixtureScope } from '../test/fixtures';
import { buildFrameworkRecommendations } from './aiFrameworks';

function aiMlComponent(id: string, service: string): ArchitectureComponent {
  return {
    id,
    name: service,
    area: 'ai-ml',
    logicalComponent: 'ai-orchestration',
    service,
    requirementIds: [],
    assumptionIds: [],
    purpose: `${service} hosts the model.`,
    rationale: `${service} is the managed AI service selected for this platform.`,
    tradeOffs: [],
    dependencies: [],
    securityConsiderations: [],
  };
}

function ragUseCase(): AiUseCase {
  return {
    id: 'AIUC_01',
    name: 'AI policy assistant',
    description: 'Retrieval-augmented generation (RAG) assistant delivering FR_03.',
    requirementIds: ['FR_03'],
    pattern: 'Retrieval-augmented generation (RAG) assistant',
    modelOptions: [],
    retrieval: 'Answers cite the retrieved passage.',
    orchestration: '',
    evaluation: '',
    safety: '',
    privacy: '',
    humanReview: '',
    monitoring: '',
    complexity: 'High',
  };
}

const ITEMS: readonly ScopeItem[] = fixtureScope().items;

describe('buildFrameworkRecommendations model hosting name', () => {
  it('names the single ai-ml service directly when only one is selected', () => {
    const components = [aiMlComponent('ARC_11', 'Azure AI Foundry')];
    const frameworks = buildFrameworkRecommendations(ITEMS, [ragUseCase()], 'azure', components);
    const hosting = frameworks.find((framework) => framework.category === 'model-service');
    expect(hosting?.name).toBe('Azure AI Foundry');
  });

  it('gives a short collective name when several managed AI services are recommended together, keeping every service in the rationale', () => {
    const components = [
      aiMlComponent('ARC_11', 'Amazon Bedrock'),
      aiMlComponent('ARC_12', 'Amazon Bedrock Knowledge Bases with the OpenSearch Serverless vector engine'),
      aiMlComponent('ARC_13', 'Amazon Textract'),
    ];
    const frameworks = buildFrameworkRecommendations(ITEMS, [ragUseCase()], 'aws', components);
    const hosting = frameworks.find((framework) => framework.category === 'model-service');
    expect(hosting?.name).toBe('Amazon Bedrock managed AI services');
    expect(hosting?.rationale).toContain('Amazon Bedrock, Amazon Bedrock Knowledge Bases with the OpenSearch Serverless vector engine, Amazon Textract');
  });

  it('falls back to a short platform-native name when no ai-ml component has been designed yet', () => {
    const frameworks = buildFrameworkRecommendations(ITEMS, [ragUseCase()], 'gcp', []);
    const hosting = frameworks.find((framework) => framework.category === 'model-service');
    expect(hosting?.name).toBe('the platform-native managed AI service');
  });

  it('cites the reviewed use case requirement ids in every recommendation rationale', () => {
    const frameworks = buildFrameworkRecommendations(ITEMS, [ragUseCase()], 'azure', [aiMlComponent('ARC_11', 'Azure AI Foundry')]);
    for (const framework of frameworks) {
      expect(framework.requirementIds.length).toBeGreaterThan(0);
      expect(framework.rationale.length).toBeGreaterThan(0);
    }
  });

  it('names the platform in the model-hosting rationale with its customer-facing label, not the raw platform id', () => {
    const components = [aiMlComponent('ARC_11', 'Azure AI Foundry')];
    const frameworks = buildFrameworkRecommendations(ITEMS, [ragUseCase()], 'azure', components);
    const hosting = frameworks.find((framework) => framework.category === 'model-service');
    expect(hosting?.rationale).toContain('Microsoft Azure account boundary');
    expect(hosting?.rationale).not.toContain('AZURE');
  });
});
