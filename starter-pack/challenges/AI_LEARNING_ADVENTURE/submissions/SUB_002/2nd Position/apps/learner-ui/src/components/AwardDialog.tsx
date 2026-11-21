import { useEffect } from 'react';
import type { AwardDefinition, CatalogDto } from '@ai-learning-adventure/types';
import { useAppDispatch, useAppSelector } from '../store/index.ts';
import {
  dequeueAward,
  selectNextAwardDialog,
} from '../store/progressProjectionSlice.ts';
import { useFocusReturn } from '../hooks/ui/useFocusReturn.ts';
import { announceLive } from '../hooks/ui/useLiveAnnouncement.ts';

export interface AwardDialogProps {
  catalog: CatalogDto;
}

interface AwardDialogContentProps {
  award: AwardDefinition;
  onDismiss: () => void;
}

function AwardDialogContent({ award, onDismiss }: AwardDialogContentProps) {
  const isBadge = award.kind === 'badge';
  const { overlayRef } = useFocusReturn<HTMLDivElement>({ open: true, trapFocus: true });

  useEffect(() => {
    announceLive(
      isBadge
        ? `Badge earned: ${award.name}. ${award.description}`
        : `Milestone reached: ${award.name}. ${award.description}`,
      'assertive',
    );
  }, [award, isBadge]);

  return (
    <div className="award-overlay">
      <div
        ref={overlayRef}
        className={`award-dialog ${isBadge ? 'award-dialog--badge' : 'award-dialog--milestone'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="award-dialog-title"
      >
        <p className="award-dialog__eyebrow">{isBadge ? 'Badge earned!' : 'Milestone reached!'}</p>
        <div className="award-dialog__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="56" height="56" focusable="false">
            <circle cx="12" cy="9" r="6" fill="currentColor" opacity="0.25" />
            <circle cx="12" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
              d="M8.5 14 7 21l5-2.5L17 21l-1.5-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 id="award-dialog-title" className="award-dialog__title">
          {award.name}
        </h2>
        <p className="award-dialog__reason">{award.description}</p>
        <button type="button" className="button button--primary" onClick={onDismiss}>
          Nice!
        </button>
      </div>
    </div>
  );
}

export function AwardDialog({ catalog }: AwardDialogProps) {
  const dispatch = useAppDispatch();
  const nextAwardId = useAppSelector(selectNextAwardDialog);
  const award =
    nextAwardId !== undefined
      ? catalog.awards.find((candidate) => candidate.id === nextAwardId)
      : undefined;

  useEffect(() => {
    if (nextAwardId !== undefined && award === undefined) {
      dispatch(dequeueAward());
    }
  }, [nextAwardId, award, dispatch]);

  if (award === undefined) return null;

  return (
    <AwardDialogContent
      key={award.id as string}
      award={award}
      onDismiss={() => dispatch(dequeueAward())}
    />
  );
}
