import type { MissionDetail } from '@ai-learning-adventure/types';
import type { UseConversationalWalkthroughResult } from '../hooks/useConversationalWalkthrough.ts';

export interface WalkthroughTurnCardProps {
  mission: MissionDetail;
  walkthrough: UseConversationalWalkthroughResult;
}

function LessonContent({ mission }: { mission: MissionDetail }) {
  return (
    <div className="ai-walkthrough__authored-content">
      {mission.lesson.map((block, index) => {
        switch (block.type) {
          case 'paragraph':
            return <p key={index}>{block.text}</p>;
          case 'list':
            return <ul key={index}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
          case 'callout':
            return <div key={index} className="ai-walkthrough__callout"><strong>{block.title ?? 'Key idea'}</strong><p>{block.text}</p></div>;
          case 'key_term':
            return <p key={index}><strong>Key term:</strong> {block.term}</p>;
        }
      })}
    </div>
  );
}

function ExampleContent({ mission }: { mission: MissionDetail }) {
  return mission.example.type === 'worked_example' ? (
    <div className="ai-walkthrough__authored-content">
      <p><strong>Before:</strong> {mission.example.before}</p>
      <p><strong>After:</strong> {mission.example.after}</p>
      <ul>{mission.example.annotations.map((annotation) => <li key={annotation}>{annotation}</li>)}</ul>
    </div>
  ) : (
    <div className="ai-walkthrough__authored-content">
      <p>{mission.example.narrative}</p>
      <p><strong>Think about:</strong> {mission.example.reflectionPrompt}</p>
      <p><strong>Takeaway:</strong> {mission.example.takeaway}</p>
    </div>
  );
}

function CheckpointPreview({ mission }: { mission: MissionDetail }) {
  return (
    <div className="ai-walkthrough__authored-content">
      <p>{mission.checkpoint.prompt}</p>
      <p className="ai-message__meta">This is a preview. Complete the checkpoint in the mission to receive credit.</p>
    </div>
  );
}

export function WalkthroughTurnCard({ mission, walkthrough }: WalkthroughTurnCardProps) {
  if (!walkthrough.active && !walkthrough.complete) {
    return (
      <section className="ai-walkthrough ai-walkthrough--start" aria-label="Mission walkthrough">
        <div>
          <p className="ai-eyebrow">Guided route</p>
          <h2>Walk through {mission.title}</h2>
          <p>Move through the objective, lesson, example, and checkpoint preview without leaving the conversation.</p>
        </div>
        <button type="button" className="button button--primary" onClick={walkthrough.start}>
          Walk me through this mission
        </button>
      </section>
    );
  }

  if (walkthrough.complete) {
    return (
      <section className="ai-walkthrough ai-walkthrough--complete" aria-label="Walkthrough complete">
        <span className="ai-walkthrough__complete-mark" aria-hidden="true">✓</span>
        <div>
          <p className="ai-eyebrow">Walkthrough complete</p>
          <h2>You covered the mission path</h2>
          <p>The authored checkpoint and full quiz remain separate, so your completion rules stay intact.</p>
          {walkthrough.progressNotice !== undefined && <p className="ai-walkthrough__progress-notice">{walkthrough.progressNotice}</p>}
        </div>
        <div className="ai-walkthrough__completion-actions">
          <button type="button" className="button button--primary" onClick={walkthrough.takeFullQuiz}>
            Take the full quiz
          </button>
          {walkthrough.nextMission !== undefined && (
            <button type="button" className="button button--secondary" onClick={walkthrough.startNextMission}>
              Next mission
            </button>
          )}
        </div>
      </section>
    );
  }

  const step = walkthrough.currentStep;
  if (step === undefined) return null;
  const title = step === 'objective' ? 'Your objective' : step[0]?.toUpperCase() + step.slice(1);

  return (
    <section className="ai-walkthrough" aria-labelledby="ai-walkthrough-turn-title">
      <div className="ai-walkthrough__tracker">
        <span>Step {walkthrough.stepNumber} of {walkthrough.totalSteps}</span>
        <div className="ai-walkthrough__track" aria-hidden="true">
          <span style={{ width: `${(walkthrough.stepNumber / walkthrough.totalSteps) * 100}%` }} />
        </div>
      </div>
      <div className="ai-walkthrough__turn-heading">
        <span className="ai-walkthrough__anchor">Authored mission content</span>
        <h2 id="ai-walkthrough-turn-title">{title}</h2>
      </div>
      {step === 'objective' && <p className="ai-walkthrough__objective">{mission.objective}</p>}
      {step === 'lesson' && <LessonContent mission={mission} />}
      {step === 'example' && <ExampleContent mission={mission} />}
      {step === 'checkpoint' && <CheckpointPreview mission={mission} />}

      {walkthrough.quiz !== undefined && (
        <div className="ai-walkthrough-quiz" aria-label="Walkthrough question">
          <div className="ai-walkthrough-quiz__header">
            <strong>Quick check</strong>
            <button type="button" className="button button--ghost button--small" onClick={walkthrough.closeQuiz}>Close</button>
          </div>
          {walkthrough.quiz.question.type === 'scenario' && <p>{walkthrough.quiz.question.scenario}</p>}
          <p><strong>{walkthrough.quiz.question.stem}</strong></p>
          <div className="ai-walkthrough-quiz__options">
            {walkthrough.quiz.question.options.map((option) => (
              <label key={option.id}>
                <input
                  type={walkthrough.quiz?.question.selectionMode === 'multiple' ? 'checkbox' : 'radio'}
                  name="ai-walkthrough-question"
                  checked={walkthrough.quiz?.selectedOptionIds.includes(option.id) ?? false}
                  disabled={walkthrough.quiz?.grade !== undefined}
                  onChange={() => walkthrough.selectQuizOption(option.id)}
                />
                {option.text}
              </label>
            ))}
          </div>
          {walkthrough.quiz.grade === undefined ? (
            <button
              type="button"
              className="button button--secondary button--small"
              disabled={walkthrough.quiz.selectedOptionIds.length === 0}
              onClick={walkthrough.submitQuizAnswer}
            >
              Check answer
            </button>
          ) : (
            <div className={`ai-walkthrough-quiz__result ai-walkthrough-quiz__result--${walkthrough.quiz.grade.isCorrect ? 'correct' : 'incorrect'}`}>
              <strong>{walkthrough.quiz.grade.isCorrect ? 'That reasoning fits.' : 'Not quite yet.'}</strong>
              <p>{walkthrough.quiz.grade.isCorrect ? walkthrough.quiz.question.correctExplanation : walkthrough.quiz.question.incorrectExplanation}</p>
              <button type="button" className="button button--ghost button--small" onClick={() => void walkthrough.explainQuizAnswer()}>
                Ask AI to explain
              </button>
            </div>
          )}
        </div>
      )}

      <div className="ai-walkthrough__actions">
        <button type="button" className="button button--primary button--small" disabled={walkthrough.saving} onClick={() => void walkthrough.next()}>
          {step === 'checkpoint' ? 'Finish walkthrough' : 'I get it - next'}
        </button>
        <button type="button" className="button button--ghost button--small" onClick={() => void walkthrough.explainDifferently()}>
          Explain differently
        </button>
        <button type="button" className="button button--ghost button--small" onClick={() => void walkthrough.giveExample()}>
          Give an example
        </button>
        <button type="button" className="button button--ghost button--small" onClick={walkthrough.quizMe}>
          Quiz me on this
        </button>
      </div>
    </section>
  );
}
