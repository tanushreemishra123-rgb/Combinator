import type { LessonBlock } from '@ai-learning-adventure/types';

export interface LessonBlockViewProps {
  block: LessonBlock;
  onOpenKeyTerm: (flashcardId: string, term: string) => void;
}

const CALLOUT_DEFAULT_TITLES: Record<'key_idea' | 'watch_out', string> = {
  key_idea: 'Key idea',
  watch_out: 'Watch out',
};

export function LessonBlockView({ block, onOpenKeyTerm }: LessonBlockViewProps) {
  switch (block.type) {
    case 'paragraph':
      return <p className="lesson-step__paragraph">{block.text}</p>;
    case 'list':
      return (
        <ul className="lesson-step__list">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case 'callout':
      return (
        <div className={`lesson-callout lesson-callout--${block.tone}`}>
          <p className="lesson-callout__title">{block.title ?? CALLOUT_DEFAULT_TITLES[block.tone] /* nosemgrep: gitlab.eslint.detect-object-injection */}</p>
          <p className="lesson-callout__text">{block.text}</p>
        </div>
      );
    case 'key_term':
      return (
        <button
          type="button"
          className="key-term"
          onClick={() => onOpenKeyTerm(block.flashcardId, block.term)}
        >
          {block.term}
        </button>
      );
  }
}
