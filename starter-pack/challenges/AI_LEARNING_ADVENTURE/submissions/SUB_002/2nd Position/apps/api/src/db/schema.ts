import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type LevelTrack =
  | 'beginner'
  | 'basic_understanding'
  | 'applied_practice'
  | 'responsible_use'
  | 'builder_mindset';
export type ContentStatus = 'draft' | 'published' | 'disabled';
export type MissionStep = 'lesson' | 'example' | 'checkpoint' | 'quiz' | 'result';
export type QuestionType = 'multiple_choice' | 'true_false' | 'scenario';
export type QuestionSelectionMode = 'single' | 'multiple';
export type AwardKind = 'badge' | 'milestone';
export type AwardRuleType =
  | 'mission_completed'
  | 'track_completed'
  | 'score_threshold'
  | 'streak'
  | 'percent_complete';
export type MissionProgressStatus = 'not_started' | 'in_progress' | 'completed';
export type QuizAttemptResult = 'passed' | 'needs_review';
export type FlashcardRatingValue = 'got_it' | 'needs_work';

export const missions = sqliteTable(
  'missions',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    difficulty: text('difficulty').$type<Difficulty>().notNull(),
    levelTrack: text('level_track').$type<LevelTrack>().notNull(),
    trackOrder: integer('track_order').notNull(),
    objective: text('objective').notNull(),
    lessonJson: text('lesson_json').notNull(),
    exampleJson: text('example_json').notNull(),
    checkpointJson: text('checkpoint_json').notNull(),
    estimatedMinutes: integer('estimated_minutes').notNull(),
    passThreshold: integer('pass_threshold').notNull().default(70),
    prerequisiteMissionId: text('prerequisite_mission_id').references(
      (): AnySQLiteColumn => missions.id,
      { onDelete: 'set null' },
    ),
    status: text('status').$type<ContentStatus>().notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull(),
    contentVersion: integer('content_version').notNull(),
    publishedAt: text('published_at'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('missions_track_order_idx').on(table.levelTrack, table.trackOrder),
  ],
);

export const quizQuestions = sqliteTable(
  'quiz_questions',
  {
    id: text('id').primaryKey(),
    missionId: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    type: text('type').$type<QuestionType>().notNull(),
    stem: text('stem').notNull(),
    scenario: text('scenario'),
    selectionMode: text('selection_mode').$type<QuestionSelectionMode>().notNull(),
    optionsJson: text('options_json').notNull(),
    correctExplanation: text('correct_explanation').notNull(),
    incorrectExplanation: text('incorrect_explanation').notNull(),
    conceptTagsJson: text('concept_tags_json').notNull(),
    difficulty: text('difficulty').$type<Difficulty>().notNull(),
    allowsReasoning: integer('allows_reasoning', { mode: 'boolean' }).notNull(),
    displayOrder: integer('display_order').notNull(),
    status: text('status').$type<ContentStatus>().notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('quiz_questions_mission_order_idx').on(table.missionId, table.displayOrder),
  ],
);

export const flashcards = sqliteTable(
  'flashcards',
  {
    id: text('id').primaryKey(),
    missionId: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    concept: text('concept').notNull(),
    definition: text('definition').notNull(),
    example: text('example').notNull(),
    commonMistake: text('common_mistake'),
    learningTip: text('learning_tip'),
    conceptTagsJson: text('concept_tags_json').notNull(),
    difficulty: text('difficulty').$type<Difficulty>().notNull(),
    displayOrder: integer('display_order').notNull(),
    status: text('status').$type<ContentStatus>().notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('flashcards_mission_order_idx').on(table.missionId, table.displayOrder),
  ],
);

export const awards = sqliteTable('awards', {
  id: text('id').primaryKey(),
  kind: text('kind').$type<AwardKind>().notNull(),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  description: text('description').notNull(),
  missionId: text('mission_id').references(() => missions.id, {
    onDelete: 'set null',
  }),
  ruleType: text('rule_type').$type<AwardRuleType>().notNull(),
  ruleJson: text('rule_json').notNull(),
  status: text('status').$type<ContentStatus>().notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull(),
  updatedAt: text('updated_at').notNull(),
});

export type AdminEntityType = 'mission' | 'question' | 'flashcard' | 'award';

export const contentItems = sqliteTable(
  'content_items',
  {
    entityType: text('entity_type').$type<AdminEntityType>().notNull(),
    entityId: text('entity_id').notNull(),
    docJson: text('doc_json').notNull(),
    revision: integer('revision').notNull(),
    publishedRevision: integer('published_revision'),
    isPublished: integer('is_published', { mode: 'boolean' }).notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull(),
    archived: integer('archived', { mode: 'boolean' }).notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.entityType, table.entityId] })],
);

export const contentPublishHistory = sqliteTable('content_publish_history', {
  seq: integer('seq').primaryKey({ autoIncrement: true }),
  entityType: text('entity_type').$type<AdminEntityType>().notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').$type<'publish' | 'unpublish'>().notNull(),
  note: text('note'),
  revision: integer('revision').notNull(),
  createdAt: text('created_at').notNull(),
});

export const missionContentVersions = sqliteTable(
  'mission_content_versions',
  {
    missionId: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    contentVersion: integer('content_version').notNull(),
    bundleJson: text('bundle_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.missionId, table.contentVersion] })],
);

export const learners = sqliteTable('learners', {
  id: text('id').primaryKey(),
  schemaVersion: integer('schema_version').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const missionProgress = sqliteTable(
  'mission_progress',
  {
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id, { onDelete: 'cascade' }),
    missionId: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    status: text('status').$type<MissionProgressStatus>().notNull(),
    furthestStep: text('furthest_step').$type<MissionStep>().notNull(),
    checkpointCompleted: integer('checkpoint_completed', { mode: 'boolean' }).notNull(),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.learnerId, table.missionId] }),
    index('mission_progress_learner_status_idx').on(table.learnerId, table.status),
  ],
);

export const quizAttempts = sqliteTable(
  'quiz_attempts',
  {
    id: text('id').primaryKey(),
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id, { onDelete: 'cascade' }),
    missionId: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    contentVersion: integer('content_version').notNull(),
    answersJson: text('answers_json').notNull(),
    scorePercent: integer('score_percent').notNull(),
    correctCount: integer('correct_count').notNull(),
    questionCount: integer('question_count').notNull(),
    result: text('result').$type<QuizAttemptResult>().notNull(),
    weakTopicsJson: text('weak_topics_json').notNull(),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at').notNull(),
  },
  (table) => [
    index('quiz_attempts_learner_mission_completed_idx').on(
      table.learnerId,
      table.missionId,
      table.completedAt,
    ),
  ],
);

export const flashcardRatings = sqliteTable(
  'flashcard_ratings',
  {
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id, { onDelete: 'cascade' }),
    flashcardId: text('flashcard_id')
      .notNull()
      .references(() => flashcards.id, { onDelete: 'cascade' }),
    rating: text('rating').$type<FlashcardRatingValue>().notNull(),
    reviewCount: integer('review_count').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.learnerId, table.flashcardId] })],
);

export const earnedAwards = sqliteTable(
  'earned_awards',
  {
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id, { onDelete: 'cascade' }),
    awardId: text('award_id')
      .notNull()
      .references(() => awards.id, { onDelete: 'cascade' }),
    earnedAt: text('earned_at').notNull(),
    sourceJson: text('source_json').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.learnerId, table.awardId] }),
    index('earned_awards_learner_idx').on(table.learnerId),
  ],
);

export const progressIdempotency = sqliteTable(
  'progress_idempotency',
  {
    learnerId: text('learner_id')
      .notNull()
      .references(() => learners.id, { onDelete: 'cascade' }),
    idempotencyKey: text('idempotency_key').notNull(),
    operation: text('operation').notNull(),
    responseJson: text('response_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.learnerId, table.idempotencyKey] })],
);

export type Mission = typeof missions.$inferSelect;
export type NewMission = typeof missions.$inferInsert;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type NewQuizQuestion = typeof quizQuestions.$inferInsert;
export type Flashcard = typeof flashcards.$inferSelect;
export type NewFlashcard = typeof flashcards.$inferInsert;
export type Award = typeof awards.$inferSelect;
export type NewAward = typeof awards.$inferInsert;
export type Learner = typeof learners.$inferSelect;
export type NewLearner = typeof learners.$inferInsert;
export type MissionProgress = typeof missionProgress.$inferSelect;
export type NewMissionProgress = typeof missionProgress.$inferInsert;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type NewQuizAttempt = typeof quizAttempts.$inferInsert;
export type FlashcardRating = typeof flashcardRatings.$inferSelect;
export type NewFlashcardRating = typeof flashcardRatings.$inferInsert;
export type EarnedAward = typeof earnedAwards.$inferSelect;
export type NewEarnedAward = typeof earnedAwards.$inferInsert;
export type ProgressIdempotencyRecord = typeof progressIdempotency.$inferSelect;
export type NewProgressIdempotencyRecord = typeof progressIdempotency.$inferInsert;
export type ContentItem = typeof contentItems.$inferSelect;
export type NewContentItem = typeof contentItems.$inferInsert;
export type ContentPublishHistoryEntry = typeof contentPublishHistory.$inferSelect;
export type NewContentPublishHistoryEntry = typeof contentPublishHistory.$inferInsert;
export type MissionContentVersion = typeof missionContentVersions.$inferSelect;
export type NewMissionContentVersion = typeof missionContentVersions.$inferInsert;
