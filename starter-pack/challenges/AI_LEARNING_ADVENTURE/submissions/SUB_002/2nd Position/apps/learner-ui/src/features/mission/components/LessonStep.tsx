import { useState } from 'react';
import type { FlashcardId, MissionDetail } from '@ai-learning-adventure/types';
import { buildMissionStepContext } from '@ai-learning-adventure/learner';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';
import { DeferredAiAction } from './DeferredAiAction.tsx';
import { KeyTermPopover } from './KeyTermPopover.tsx';
import { LessonBlockView } from './LessonBlockView.tsx';

export interface LessonStepProps {
  mission: MissionDetail;
}

interface ActiveKeyTerm {
  flashcardId: FlashcardId;
  term: string;
}

export function LessonStep({ mission }: LessonStepProps) {
  const { navigate } = useAppNavigation();
  const [activeKeyTerm, setActiveKeyTerm] = useState<ActiveKeyTerm | undefined>(undefined);

  const activeFlashcard =
    activeKeyTerm !== undefined
      ? mission.flashcards.find((card) => card.id === activeKeyTerm.flashcardId)
      : undefined;

  return (
    <section className="lesson-step" aria-label="Lesson">
      <h2 id="mission-step-heading" className="lesson-step__heading" tabIndex={-1}>
        Lesson
      </h2>
      <div className="lesson-step__content">
        {mission.lesson.map((block, index) => (
          <LessonBlockView
            key={`${block.type}-${index}`}
            block={block}
            onOpenKeyTerm={(flashcardId, term) =>
              setActiveKeyTerm({ flashcardId: flashcardId as FlashcardId, term })
            }
          />
        ))}
      </div>
      <div className="mission-step-footer">
        <DeferredAiAction
          label="Ask the tutor"
          missionId={mission.id}
          context={buildMissionStepContext(mission, 'lesson')}
        />
      </div>
      {activeKeyTerm !== undefined && (
        <KeyTermPopover
          term={activeKeyTerm.term}
          flashcard={activeFlashcard}
          onClose={() => setActiveKeyTerm(undefined)}
          onOpenDeck={() => {
            setActiveKeyTerm(undefined);
            navigate({ kind: 'flashcards', mode: 'mission', missionId: mission.id });
          }}
        />
      )}
    </section>
  );
}
