export type Brand<T, B extends string> = T & { readonly __brand: B };
export type MissionId = Brand<string, 'MissionId'>;
export type QuestionId = Brand<string, 'QuestionId'>;
export type FlashcardId = Brand<string, 'FlashcardId'>;
export type AwardId = Brand<string, 'AwardId'>;
export type IsoDateTime = Brand<string, 'IsoDateTime'>;

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type LevelTrack =
  | 'beginner'
  | 'basic_understanding'
  | 'applied_practice'
  | 'responsible_use'
  | 'builder_mindset';
export type ContentStatus = 'draft' | 'published' | 'disabled';
export type MissionStep = 'lesson' | 'example' | 'checkpoint' | 'quiz' | 'result';

export type LessonBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'callout'; tone: 'key_idea' | 'watch_out'; title?: string; text: string }
  | { type: 'key_term'; term: string; flashcardId: FlashcardId };

export type MissionExample =
  | { type: 'worked_example'; before: string; after: string; annotations: string[] }
  | { type: 'scenario'; narrative: string; reflectionPrompt: string; takeaway: string };

export interface TextRange {
  start: number;
  end: number;
}

export interface SortItem {
  id: string;
  text: string;
  correctBucket: string;
}

export type Checkpoint =
  | { kind: 'single_question'; prompt: string; options: QuestionOption[]; explanation: string }
  | { kind: 'write_response'; prompt: string }
  | { kind: 'sort_into_buckets'; prompt: string; buckets: string[]; items: SortItem[] }
  | { kind: 'spot_the_problem'; prompt: string; passage: string; answerRange: TextRange };

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  incorrectReason?: string;
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'scenario';
export type QuestionSelectionMode = 'single' | 'multiple';

export interface QuizQuestionBase {
  id: QuestionId;
  missionId: MissionId;
  stem: string;
  selectionMode: QuestionSelectionMode;
  options: QuestionOption[];
  correctExplanation: string;
  incorrectExplanation: string;
  conceptTags: string[];
}

export interface MultipleChoiceQuestion extends QuizQuestionBase {
  type: 'multiple_choice';
}

export interface TrueFalseQuestion extends QuizQuestionBase {
  type: 'true_false';
}

export interface ScenarioQuestion extends QuizQuestionBase {
  type: 'scenario';
  scenario: string;
  allowsReasoning: boolean;
}

export type QuizQuestion = MultipleChoiceQuestion | TrueFalseQuestion | ScenarioQuestion;

export interface Flashcard {
  id: FlashcardId;
  missionId: MissionId;
  concept: string;
  definition: string;
  example: string;
  commonMistake?: string;
  learningTip?: string;
  conceptTags: string[];
}

export interface MissionSummary {
  id: MissionId;
  title: string;
  difficulty: Difficulty;
  levelTrack: LevelTrack;
  trackOrder: number;
  objective: string;
  prerequisiteMissionId?: MissionId;
  estimatedMinutes: number;
  contentVersion: number;
}

export interface MissionDetail extends MissionSummary {
  lesson: LessonBlock[];
  example: MissionExample;
  checkpoint: Checkpoint;
  questions: QuizQuestion[];
  flashcards: Flashcard[];
  awards: AwardDefinition[];
  passThreshold: number;
}

export type AwardKind = 'badge' | 'milestone';
export type AwardRuleType =
  | 'mission_completed'
  | 'track_completed'
  | 'score_threshold'
  | 'streak'
  | 'percent_complete';

export type AwardRule =
  | { type: 'mission_completed'; missionId: MissionId }
  | { type: 'track_completed'; levelTrack: LevelTrack }
  | { type: 'score_threshold'; missionId?: MissionId; minScorePercent: number }
  | { type: 'streak'; length: number }
  | { type: 'percent_complete'; minPercent: number };

export interface AwardDefinition {
  id: AwardId;
  kind: AwardKind;
  name: string;
  icon: string;
  description: string;
  missionId?: MissionId;
  rule: AwardRule;
}
