import type {
  Checkpoint,
  Flashcard,
  MissionDetail,
  MissionId,
  MissionStep,
  QuestionOption,
  QuestionId,
  QuizQuestion,
} from './content.ts';
import type { ProgressProjection } from './progress.ts';

export type AiTask =
  | 'chat'
  | 'explain'
  | 'example'
  | 'hint'
  | 'answer_feedback'
  | 'written_feedback'
  | 'summary'
  | 'recommend';
export type ExplanationLevel = 'simple' | 'standard' | 'deeper';
export type AiProviderKind = 'openai' | 'ollama' | 'local' | 'mock';
export type AiProviderConnectionStatus =
  | 'unknown'
  | 'not_configured'
  | 'testing'
  | 'connected'
  | 'mock'
  | 'error';
export type AiProviderErrorCode =
  | 'not_configured'
  | 'unauthorized'
  | 'rate_limited'
  | 'network'
  | 'timeout'
  | 'invalid_response'
  | 'aborted';
export type AiOnlyWalkthroughStep = 'objective' | 'lesson' | 'example' | 'checkpoint';

export interface AiProviderRuntimeConfig {
  kind: AiProviderKind;
  endpoint?: string;
  modelName?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export interface AiProviderConfigMeta {
  kind: AiProviderKind;
  configured: boolean;
  endpoint?: string;
  modelName?: string;
  keyLastFour?: string;
  updatedAt?: string;
}

export interface AiProviderSafeError {
  code: AiProviderErrorCode;
  message: string;
  retryable: boolean;
}

export interface AiProviderTestResult {
  ok: boolean;
  message: string;
  error?: AiProviderSafeError;
}

export type AiMissionContext = Pick<
  MissionDetail,
  'id' | 'title' | 'objective' | 'lesson' | 'example' | 'levelTrack'
>;

export interface AiConversationTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AiQuestionContext {
  id: QuestionId;
  missionId: MissionId;
  type: QuizQuestion['type'];
  stem: string;
  selectionMode: QuizQuestion['selectionMode'];
  options: Array<Pick<QuestionOption, 'id' | 'text'>>;
  correctExplanation?: string;
  incorrectExplanation?: string;
  conceptTags: string[];
  scenario?: string;
  allowsReasoning?: boolean;
}

export interface AiContextPacket {
  mission?: AiMissionContext;
  sourceMissions?: AiMissionContext[];
  scopeTopic?: string;
  step?: MissionStep;
  question?: AiQuestionContext;
  checkpoint?: { kind: Checkpoint['kind']; prompt: string };
  flashcard?: Flashcard;
  progress?: Pick<ProgressProjection, 'completionPercent' | 'currentLevel' | 'weakTopics'>;
}

export type AiContextTarget =
  | { kind: 'content_scope'; missionIds: MissionId[]; topic?: string }
  | { kind: 'mission_step'; missionId: MissionId; step: MissionStep }
  | { kind: 'checkpoint'; missionId: MissionId; checkpointKind: Checkpoint['kind'] }
  | { kind: 'quiz_question'; missionId: MissionId; questionId: QuestionId }
  | { kind: 'flashcard'; missionId: MissionId; flashcardId: string }
  | { kind: 'weak_topics'; topics: string[]; missionIds: MissionId[] };

export interface AiTaskOptions {
  explanationLevel?: ExplanationLevel;
  priorResultId?: string;
  variationIndex?: number;
  hintLevel?: 1 | 2 | 3;
}

export interface WrittenFeedbackModel {
  strengths: string;
  missing: string;
  improvement: string;
  encouragement: string;
}

export interface SummaryItem {
  text: string;
  concept?: string;
}

export interface SummaryModel {
  title: string;
  items: SummaryItem[];
}

export type AiRecommendationModel =
  | { kind: 'mission'; missionId: MissionId; title: string; reason: string }
  | { kind: 'review'; topic: string; reason: string }
  | { kind: 'journey_complete'; reason: string };

export type AiStructuredOutput =
  | { kind: 'written_feedback'; feedback: WrittenFeedbackModel }
  | { kind: 'summary'; summary: SummaryModel }
  | { kind: 'recommendation'; recommendation: AiRecommendationModel };

export interface AiTaskRequest {
  task: AiTask;
  message?: string;
  learnerAnswer?: string;
  selectedOptionIds?: string[];
  answerOutcome?: 'correct' | 'incorrect';
  authoredExplanation?: string;
  conceptTags?: string[];
  priorExamples?: string[];
  options?: AiTaskOptions;
  hintLevel?: 1 | 2 | 3;
  explanationLevel: ExplanationLevel;
  context: AiContextPacket;
  conversation?: AiConversationTurn[];
}

export interface AiResult {
  id: string;
  text: string;
  provider: AiProviderKind;
  isMock: boolean;
  label?: 'Sample / mock AI response';
  sourceMissionIds: MissionId[];
  safety: { redirected: boolean; uncertain: boolean; hintLeakChecked: boolean };
  structured?: AiStructuredOutput;
  fallbackError?: AiProviderSafeError;
}

export interface LearnerAiProvider {
  kind: AiProviderKind;
  complete(request: AiTaskRequest, signal?: AbortSignal): Promise<AiResult>;
  stream?(
    request: AiTaskRequest,
    onToken: (token: string) => void,
    signal?: AbortSignal,
  ): Promise<AiResult>;
  test(signal?: AbortSignal): Promise<AiProviderTestResult>;
}
