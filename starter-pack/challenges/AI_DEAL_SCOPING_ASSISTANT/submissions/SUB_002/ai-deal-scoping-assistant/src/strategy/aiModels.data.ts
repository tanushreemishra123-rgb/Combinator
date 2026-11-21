/**
 * Model/provider options per cloud platform and `config.aiProviderPreference` (spec 4, "Model or
 * provider options"). A cloud-native preference stays on the platform's own managed AI service; an
 * open-source preference names an open-weight model family on that same platform; an explicit
 * openai/anthropic preference is honoured regardless of platform, with a platform-hosted alternative
 * added where the platform offers one.
 */
import type { AiProviderPreference, ArchitectureComponent, CloudPlatform } from '../domain';
import { findComponents, serviceNames } from './componentLookup';
import type { AiModality } from './aiPatterns.data';

const CLOUD_NATIVE_TEXT: ReadonlyMap<CloudPlatform, string> = new Map([
  ['aws', 'Amazon Bedrock (Anthropic Claude and Amazon Titan model families)'],
  ['azure', 'Azure OpenAI Service in Azure AI Foundry (GPT-4o class models)'],
  ['gcp', 'Vertex AI Gemini (Gemini 2.0 Pro/Flash)'],
]);

const OPEN_SOURCE_TEXT: ReadonlyMap<CloudPlatform, string> = new Map([
  ['aws', 'Llama 3 or Mistral-class open-weight models on Amazon Bedrock or self-hosted on Amazon SageMaker'],
  ['azure', 'Llama 3 or Mistral-class open-weight models from the Azure AI Foundry model catalog'],
  ['gcp', 'Llama 3 or Mistral-class open-weight models from the Vertex AI Model Garden'],
]);

const OPENAI_PLATFORM_NOTE: ReadonlyMap<CloudPlatform, string> = new Map([
  ['azure', 'or Azure OpenAI Service where private, in-VPC networking is required'],
]);
const ANTHROPIC_PLATFORM_NOTE: ReadonlyMap<CloudPlatform, string> = new Map([
  ['aws', 'or Amazon Bedrock-hosted Anthropic Claude where private, in-VPC networking is required'],
  ['gcp', 'or Vertex AI Model Garden-hosted Anthropic Claude where private, in-VPC networking is required'],
]);

const MODALITY_NOTE: ReadonlyMap<AiModality, string> = new Map([
  ['vision', "the platform's dedicated vision/multimodal model for the perception step"],
  ['speech', "the platform's speech-to-text service for the transcription step"],
]);

function baseModelOption(platform: CloudPlatform, preference: AiProviderPreference): string {
  if (preference === 'openai') {
    const note = OPENAI_PLATFORM_NOTE.get(platform);
    return note === undefined ? 'OpenAI GPT-4o / GPT-4o mini via the OpenAI API' : `OpenAI GPT-4o / GPT-4o mini via the OpenAI API, ${note}`;
  }
  if (preference === 'anthropic') {
    const note = ANTHROPIC_PLATFORM_NOTE.get(platform);
    return note === undefined ? 'Anthropic Claude (Opus/Sonnet/Haiku family) via the Anthropic API' : `Anthropic Claude (Opus/Sonnet/Haiku family) via the Anthropic API, ${note}`;
  }
  if (preference === 'open-source') {
    return OPEN_SOURCE_TEXT.get(platform) ?? OPEN_SOURCE_TEXT.get('aws') ?? '';
  }
  // 'cloud-native' and 'no-preference' both default to the platform's own managed AI service.
  return CLOUD_NATIVE_TEXT.get(platform) ?? CLOUD_NATIVE_TEXT.get('aws') ?? '';
}

/** Model options for a use case: the base platform/preference option, plus a modality-specific pairing for vision/speech. */
export function modelOptionsFor(platform: CloudPlatform, preference: AiProviderPreference, modality: AiModality): string[] {
  const base = baseModelOption(platform, preference);
  const modalityNote = MODALITY_NOTE.get(modality);
  return modalityNote === undefined ? [base] : [base, `paired with ${modalityNote}`];
}

const PLATFORM_VECTOR_SEARCH: ReadonlyMap<CloudPlatform, string> = new Map([
  ['aws', 'Amazon OpenSearch Service (vector engine)'],
  ['azure', 'Azure AI Search (vector search)'],
  ['gcp', 'Vertex AI Search / Vertex AI Vector Search'],
]);

/** Retrieval/vector-search service for a RAG or extraction use case: an ai-ml component if one is already designed, else the platform's own vector-search service. */
export function retrievalServiceFor(platform: CloudPlatform, components: readonly ArchitectureComponent[]): string {
  const aiComponents = findComponents(components, { areas: ['ai-ml'] });
  const names = serviceNames(aiComponents);
  return names.length > 0 ? names.join(', ') : (PLATFORM_VECTOR_SEARCH.get(platform) ?? PLATFORM_VECTOR_SEARCH.get('aws') ?? '');
}
