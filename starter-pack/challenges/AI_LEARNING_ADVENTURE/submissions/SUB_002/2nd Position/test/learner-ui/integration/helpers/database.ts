import type { Checkpoint, QuestionOption } from '@ai-learning-adventure/types';
import type { IntegrationApp } from '../harness.tsx';

export function replaceMissionCheckpoint(
  runtime: IntegrationApp,
  missionId: string,
  checkpoint: Checkpoint,
): void {
  runtime.app.dbHandle.sqlite
    .prepare('UPDATE missions SET checkpoint_json = ? WHERE id = ?')
    .run(JSON.stringify(checkpoint), missionId);
}

export function replaceQuestionOptions(
  runtime: IntegrationApp,
  questionId: string,
  selectionMode: 'single' | 'multiple',
  options: QuestionOption[],
): void {
  runtime.app.dbHandle.sqlite
    .prepare('UPDATE quiz_questions SET selection_mode = ?, options_json = ? WHERE id = ?')
    .run(selectionMode, JSON.stringify(options), questionId);
}
