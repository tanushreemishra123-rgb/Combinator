import type { MissionDetail } from '@ai-learning-adventure/types';
import type { UseMissionPlayerResult } from '../hooks/useMissionPlayer.ts';

export interface QuizHandoffStepProps {
  mission: MissionDetail;
  player: UseMissionPlayerResult;
}

export function QuizHandoffStep({ mission, player }: QuizHandoffStepProps) {
  return (
    <section className="quiz-handoff" aria-label="Quiz">
      <h2 id="mission-step-heading" className="quiz-handoff__heading" tabIndex={-1}>
        Quiz
      </h2>
      <div className="quiz-handoff__card">
        <p>
          Checkpoint saved. The quiz for “{mission.title}” has {mission.questions.length} question
          {mission.questions.length === 1 ? '' : 's'} and opens right here.
        </p>
        <button type="button" className="button button--primary" onClick={player.startQuiz}>
          Open the quiz
        </button>
      </div>
    </section>
  );
}
