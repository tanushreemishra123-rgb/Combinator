import { useEffect } from 'react';
import { LEVEL_TRACK_LABELS } from '@ai-learning-adventure/learner';
import { useAppDispatch, useAppSelector } from '../store/index.ts';
import { dismissLevelUp, selectLevelUpTo } from '../store/progressProjectionSlice.ts';
import { announceLive } from '../hooks/ui/useLiveAnnouncement.ts';

export function LevelUpBanner() {
  const dispatch = useAppDispatch();
  const levelUpTo = useAppSelector(selectLevelUpTo);

  useEffect(() => {
    if (levelUpTo === undefined) return;
    announceLive(`Level up! You've reached ${LEVEL_TRACK_LABELS[levelUpTo]}.`, 'assertive');
  }, [levelUpTo]);

  if (levelUpTo === undefined) return null;

  return (
    <div className="level-up-banner" role="status">
      <p className="level-up-banner__text">
        You've reached <strong>{LEVEL_TRACK_LABELS[levelUpTo]}</strong>
      </p>
      <button
        type="button"
        className="button button--ghost button--small level-up-banner__dismiss"
        onClick={() => dispatch(dismissLevelUp())}
      >
        Continue
      </button>
    </div>
  );
}
