import type {
  AwardKind,
  AwardRule,
  Checkpoint,
  Difficulty,
  IsoDateTime,
  LevelTrack,
  LessonBlock,
  MissionExample,
  QuestionOption,
  QuestionSelectionMode,
  QuestionType,
} from './content.ts';
import type { MissionDetail } from './content.ts';
import type { CatalogDto } from './api.ts';

export type AdminEntityType = 'mission' | 'question' | 'flashcard' | 'award';

export type AdminLifecycleStatus = 'draft' | 'published' | 'published_changed';

export interface AdminMissionDoc {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  levelTrack: LevelTrack;
  trackOrder: number;
  objective: string;
  lesson: LessonBlock[];
  example: MissionExample;
  checkpoint: Checkpoint;
  estimatedMinutes: number;
  passThreshold: number;
  prerequisiteMissionId?: string;
}

export interface AdminQuestionDoc {
  id: string;
  missionId: string | null;
  type: QuestionType;
  stem: string;
  scenario?: string;
  selectionMode: QuestionSelectionMode;
  options: QuestionOption[];
  correctExplanation: string;
  incorrectExplanation: string;
  conceptTags: string[];
  difficulty: Difficulty;
  allowsReasoning: boolean;
  displayOrder: number;
}

export interface AdminFlashcardDoc {
  id: string;
  missionId: string | null;
  concept: string;
  definition: string;
  example: string;
  commonMistake?: string;
  learningTip?: string;
  conceptTags: string[];
  difficulty: Difficulty;
  displayOrder: number;
}

export interface AdminAwardDoc {
  id: string;
  kind: AwardKind;
  name: string;
  icon: string;
  description: string;
  missionId?: string;
  rule: AwardRule;
}

export type AdminDoc = AdminMissionDoc | AdminQuestionDoc | AdminFlashcardDoc | AdminAwardDoc;

export interface AdminContentItem<TDoc = unknown> {
  entityType: AdminEntityType;
  id: string;
  doc: TDoc;
  revision: number;
  publishedRevision: number | null;
  status: AdminLifecycleStatus;
  enabled: boolean;
  archived: boolean;
  updatedAt: IsoDateTime;
}

export interface AdminContentListDto<TDoc = unknown> {
  items: Array<AdminContentItem<TDoc>>;
  total: number;
}

export interface AdminValidationIssue {
  severity: 'blocking' | 'warning';
  code: string;
  message: string;
  field?: string;
}

export interface AdminValidationReport {
  issues: AdminValidationIssue[];
  blockingCount: number;
  warningCount: number;
}

export interface AdminSaveRequest<TDoc = unknown> {
  doc: TDoc;
  expectedRevision: number;
}

export interface AdminPublishRequest {
  acknowledgement: boolean;
  note?: string;
  expectedRevision: number;
  includeDependentDrafts?: boolean;
}

export interface AdminUnpublishRequest {
  note?: string;
}

export interface AdminPublishResult {
  item: AdminContentItem;
  publishedDependentIds: string[];
}

export interface AdminPublishHistoryEntry {
  seq: number;
  entityType: AdminEntityType;
  entityId: string;
  action: 'publish' | 'unpublish';
  note?: string;
  revision: number;
  at: IsoDateTime;
}

export interface AdminBulkActionRequest {
  action: 'enable' | 'disable' | 'publish' | 'unpublish';
  refs: Array<{ entityType: AdminEntityType; id: string }>;
  acknowledgement?: boolean;
}

export interface AdminBulkActionResult {
  succeeded: Array<{ entityType: AdminEntityType; id: string }>;
  failed: Array<{ entityType: AdminEntityType; id: string; message: string }>;
}

export interface PracticeAssignmentChange {
  entityType: 'question' | 'flashcard';
  id: string;
  missionId: string | null;
  index: number;
}

export interface PracticeAssignmentsRequest {
  changes: PracticeAssignmentChange[];
}

export interface MissionReorderRequest {
  levelTrack: LevelTrack;
  orderedMissionIds: string[];
}

export interface AdminContentBundle {
  bundleVersion: 1;
  exportedAt?: IsoDateTime;
  missions: AdminMissionDoc[];
  questions: AdminQuestionDoc[];
  flashcards: AdminFlashcardDoc[];
  awards: AdminAwardDoc[];
}

export interface AdminImportRequest {
  bundle: AdminContentBundle;
  mode: 'merge' | 'replace';
  dryRun: boolean;
}

export interface AdminImportReport {
  dryRun: boolean;
  applied: boolean;
  perType: Record<AdminEntityType, { added: number; updated: number; skipped: number; invalid: number }>;
  errors: Array<{ entityType: AdminEntityType; id?: string; message: string }>;
}

export interface AdminSeedIntegrityCheck {
  rule: string;
  ok: boolean;
  detail: string;
}

export interface AdminSeedIntegrityRow {
  missionId: string;
  title: string;
  checks: AdminSeedIntegrityCheck[];
}

export interface AdminSeedStatusDto {
  counts: { missions: number; questions: number; flashcards: number; awards: number };
  integrity: AdminSeedIntegrityRow[];
}

export interface AdminPreviewRequest {
  missionId: string;
}

export interface AdminPreviewSessionDto {
  token: string;
  learnerUrl: string;
}

export interface PreviewPayloadDto {
  catalog: CatalogDto;
  mission: MissionDetail;
}
