import type { CatalogDto, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { AppView } from './AppView.tsx';
import { GlobalHeader } from './GlobalHeader.tsx';
import { AwardDialog } from '../components/AwardDialog.tsx';
import { LevelUpBanner } from '../components/LevelUpBanner.tsx';
import { LiveRegion } from '../components/LiveRegion.tsx';
import { InlineTutorPanel } from '../features/tutor/components/InlineTutorPanel.tsx';
import { AiAvailabilityBanner } from '../components/AiAvailabilityBanner.tsx';
import { useAppSelector } from '../store/index.ts';
import { selectIsAiOnlyMode } from '../store/navigationSlice.ts';

export interface AppShellProps {
  learnerId: string;
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
}

export function AppShell({ learnerId, catalog, progress }: AppShellProps) {
  const isAiOnlyMode = useAppSelector(selectIsAiOnlyMode);
  return (
    <div className={`app-shell${isAiOnlyMode ? ' app-shell--ai-only' : ''}`}>
      <a className="skip-link" href="#app-main-content">
        Skip to content
      </a>
      {!isAiOnlyMode && <GlobalHeader catalog={catalog} progress={progress} />}
      <LevelUpBanner />
      <AiAvailabilityBanner />
      <main id="app-main-content" className="app-shell__main" tabIndex={-1}>
        <AppView learnerId={learnerId} catalog={catalog} progress={progress} />
      </main>
      <AwardDialog catalog={catalog} />
      {!isAiOnlyMode && <InlineTutorPanel />}
      <LiveRegion />
    </div>
  );
}
