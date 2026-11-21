import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.ts';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export type QueryClient = Pick<AppDatabase, 'select' | 'insert' | 'update' | 'delete'>;

export interface DatabaseHandle {
  sqlite: Database.Database;
  db: AppDatabase;
  close: () => void;
}

const bootstrapSql = `
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  level_track TEXT NOT NULL,
  track_order INTEGER NOT NULL,
  objective TEXT NOT NULL,
  lesson_json TEXT NOT NULL,
  example_json TEXT NOT NULL,
  checkpoint_json TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL,
  pass_threshold INTEGER NOT NULL DEFAULT 70,
  prerequisite_mission_id TEXT REFERENCES missions(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  content_version INTEGER NOT NULL,
  published_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  stem TEXT NOT NULL,
  scenario TEXT,
  selection_mode TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_explanation TEXT NOT NULL,
  incorrect_explanation TEXT NOT NULL,
  concept_tags_json TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  allows_reasoning INTEGER NOT NULL,
  display_order INTEGER NOT NULL,
  status TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS flashcards (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  definition TEXT NOT NULL,
  example TEXT NOT NULL,
  common_mistake TEXT,
  learning_tip TEXT,
  concept_tags_json TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  status TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS awards (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT NOT NULL,
  mission_id TEXT REFERENCES missions(id) ON DELETE SET NULL,
  rule_type TEXT NOT NULL,
  rule_json TEXT NOT NULL,
  status TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_items (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  doc_json TEXT NOT NULL,
  revision INTEGER NOT NULL,
  published_revision INTEGER,
  is_published INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  archived INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS content_publish_history (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mission_content_versions (
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  content_version INTEGER NOT NULL,
  bundle_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (mission_id, content_version)
);

CREATE TABLE IF NOT EXISTS learners (
  id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mission_progress (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  furthest_step TEXT NOT NULL,
  checkpoint_completed INTEGER NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, mission_id)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  content_version INTEGER NOT NULL,
  answers_json TEXT NOT NULL,
  score_percent INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  question_count INTEGER NOT NULL,
  result TEXT NOT NULL,
  weak_topics_json TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS flashcard_ratings (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  flashcard_id TEXT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  rating TEXT NOT NULL,
  review_count INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, flashcard_id)
);

CREATE TABLE IF NOT EXISTS earned_awards (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  award_id TEXT NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
  earned_at TEXT NOT NULL,
  source_json TEXT NOT NULL,
  PRIMARY KEY (learner_id, award_id)
);

CREATE TABLE IF NOT EXISTS progress_idempotency (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS missions_track_order_idx
  ON missions (level_track, track_order);
CREATE INDEX IF NOT EXISTS quiz_questions_mission_order_idx
  ON quiz_questions (mission_id, display_order);
CREATE INDEX IF NOT EXISTS flashcards_mission_order_idx
  ON flashcards (mission_id, display_order);
CREATE INDEX IF NOT EXISTS mission_progress_learner_status_idx
  ON mission_progress (learner_id, status);
CREATE INDEX IF NOT EXISTS quiz_attempts_learner_mission_completed_idx
  ON quiz_attempts (learner_id, mission_id, completed_at);
CREATE INDEX IF NOT EXISTS earned_awards_learner_idx
  ON earned_awards (learner_id);
`;

export function ensureSchema(sqlite: Database.Database): void {
  sqlite.exec(bootstrapSql);
}

export function openDatabase(file: string): DatabaseHandle {
  const resolved = file === ':memory:' ? file : resolve(file);
  if (resolved !== ':memory:') {
    mkdirSync(dirname(resolved), { recursive: true });
  }
  const sqlite = new Database(resolved);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  ensureSchema(sqlite);
  const db = drizzle(sqlite, { schema });
  return {
    sqlite,
    db,
    close: () => sqlite.close(),
  };
}
