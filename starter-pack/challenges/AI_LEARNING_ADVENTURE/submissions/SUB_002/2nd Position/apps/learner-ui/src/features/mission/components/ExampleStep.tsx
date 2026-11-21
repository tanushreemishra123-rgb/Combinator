import type { MissionDetail } from '@ai-learning-adventure/types';
import { buildMissionStepContext } from '@ai-learning-adventure/learner';
import { DeferredAiAction } from './DeferredAiAction.tsx';

export interface ExampleStepProps {
  mission: MissionDetail;
}

export function ExampleStep({ mission }: ExampleStepProps) {
  const example = mission.example;

  return (
    <section className="example-step" aria-label="Example">
      <h2 id="mission-step-heading" className="example-step__heading" tabIndex={-1}>
        Example
      </h2>
      {example.type === 'worked_example' ? (
        <div className="worked-example">
          <div className="worked-example__pair">
            <div className="worked-example__card worked-example__card--before">
              <p className="worked-example__label">Before</p>
              <pre className="worked-example__text">{example.before}</pre>
            </div>
            <div className="worked-example__card worked-example__card--after">
              <p className="worked-example__label">After</p>
              <pre className="worked-example__text">{example.after}</pre>
            </div>
          </div>
          {example.annotations.length > 0 && (
            <ul className="worked-example__annotations" aria-label="Why the rewrite works">
              {example.annotations.map((annotation) => (
                <li key={annotation}>{annotation}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="scenario-example">
          <div className="scenario-example__narrative">
            <p>{example.narrative}</p>
          </div>
          <p className="scenario-example__prompt">{example.reflectionPrompt}</p>
          <details className="scenario-example__takeaway">
            <summary>Reveal the takeaway</summary>
            <p>{example.takeaway}</p>
          </details>
        </div>
      )}
      <div className="mission-step-footer">
        <DeferredAiAction
          label="Ask for another example"
          missionId={mission.id}
          context={buildMissionStepContext(mission, 'example')}
        />
      </div>
    </section>
  );
}
