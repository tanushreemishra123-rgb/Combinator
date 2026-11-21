import { useEffect, useRef, type ReactNode } from 'react';
import type { CatalogDto, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { useAppDispatch, useAppSelector } from '../store/index.ts';
import {
  selectCurrentView,
  selectReturnFocusId,
  setReturnFocus,
  type LearnerView,
} from '../store/navigationSlice.ts';
import { useAppNavigation } from '../hooks/useAppNavigation.ts';
import { HomeView } from '../features/mission/components/HomeView.tsx';
import { MissionBrowserView } from '../features/mission/components/MissionBrowserView.tsx';
import { MissionPlayerView } from '../features/mission/components/MissionPlayerView.tsx';
import { QuizView } from '../features/practice/components/QuizView.tsx';
import { FlashcardView } from '../features/practice/components/FlashcardView.tsx';
import { ReviewHub } from '../features/practice/components/ReviewHub.tsx';
import { ProgressView } from '../features/progress/components/ProgressView.tsx';
import { AiOnlyView } from '../features/tutor/components/AiOnlyView.tsx';
import { SettingsView } from '../features/settings/components/SettingsView.tsx';
import { ScreenNavigation } from './ScreenNavigation.tsx';

export interface AppViewProps {
  learnerId: string;
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
}

const VIEW_LABELS: Record<LearnerView['kind'], string> = {
  home: 'Home',
  missions: 'Mission browser',
  mission: 'Mission',
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  review: 'Review',
  progress: 'Progress',
  'ai-only': 'AI Only Mode',
  settings: 'Settings',
};

function viewDocumentTitle(view: LearnerView, catalog: CatalogDto): string {
  const base = 'AI Learning Adventure';
  switch (view.kind) {
    case 'home':
      return base;
    case 'mission': {
      const mission = catalog.missions.find((candidate) => candidate.id === view.missionId);
      return mission !== undefined ? `${mission.title} · ${base}` : `${VIEW_LABELS.mission} · ${base}`;
    }
    default:
      return `${VIEW_LABELS[view.kind] /* nosemgrep: gitlab.eslint.detect-object-injection */} · ${base}`;
  }
}

function isSameMissionStepChange(previous: LearnerView | undefined, next: LearnerView): boolean {
  if (previous === undefined || previous.kind !== 'mission' || next.kind !== 'mission') return false;
  return previous.missionId === next.missionId && previous.step !== next.step;
}

export function AppView({ learnerId, catalog, progress }: AppViewProps) {
  const dispatch = useAppDispatch();
  const view = useAppSelector(selectCurrentView);
  const returnFocusId = useAppSelector(selectReturnFocusId);
  const mainRef = useRef<HTMLElement | null>(null);
  const previousViewRef = useRef<LearnerView | undefined>(undefined);

  useEffect(() => {
    document.title = viewDocumentTitle(view, catalog);
  }, [view, catalog]);

  useEffect(() => {
    const stepOnlyChange = isSameMissionStepChange(previousViewRef.current, view);
    previousViewRef.current = view;
    if (stepOnlyChange) return;
    mainRef.current = document.getElementById('app-main-content');
    if (returnFocusId !== undefined) {
      const trigger = document.getElementById(returnFocusId);
      if (trigger !== null) {
        trigger.focus({ preventScroll: true });
        dispatch(setReturnFocus(undefined));
        return;
      }
    }
    if (view.kind === 'settings') {
      const providerHeading = document.getElementById('ai-provider-heading');
      if (providerHeading !== null) {
        providerHeading.focus({ preventScroll: true });
        return;
      }
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [view, returnFocusId, dispatch]);

  let screen: ReactNode;
  switch (view.kind) {
    case 'home':
      screen = <HomeView learnerId={learnerId} catalog={catalog} progress={progress} />;
      break;
    case 'missions':
      screen = <MissionBrowserView catalog={catalog} progress={progress} />;
      break;
    case 'mission':
      screen = (
        <MissionPlayerView learnerId={learnerId} view={view} catalog={catalog} progress={progress} />
      );
      break;
    case 'quiz':
      screen = <QuizView learnerId={learnerId} view={view} catalog={catalog} progress={progress} />;
      break;
    case 'flashcards':
      screen = (
        <FlashcardView learnerId={learnerId} view={view} catalog={catalog} progress={progress} />
      );
      break;
    case 'review':
      screen = <ReviewHub catalog={catalog} progress={progress} />;
      break;
    case 'progress':
      screen = <ProgressView catalog={catalog} progress={progress} />;
      break;
    case 'ai-only':
      screen = (
        <AiOnlyView
          learnerId={learnerId}
          view={view}
          catalog={catalog}
          progress={progress}
          navigation={<ScreenNavigation />}
        />
      );
      break;
    case 'settings':
      screen = <SettingsView />;
      break;
  }

  return (
    <div className={`app-screen app-screen--${view.kind}`}>
      {view.kind !== 'ai-only' && view.kind !== 'home' && <ScreenNavigation />}
      {screen}
    </div>
  );
}
