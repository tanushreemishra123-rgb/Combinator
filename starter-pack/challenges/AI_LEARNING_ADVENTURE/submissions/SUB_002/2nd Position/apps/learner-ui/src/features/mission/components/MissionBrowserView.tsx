import type { CatalogDto, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { useMissionBrowser } from '../hooks/useMissionBrowser.ts';
import { MissionBrowserToolbar } from './MissionBrowserToolbar.tsx';
import { MissionList } from './MissionList.tsx';
import { MissionMap } from './MissionMap.tsx';

export interface MissionBrowserViewProps {
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
}

export function MissionBrowserView({ catalog, progress }: MissionBrowserViewProps) {
  const browser = useMissionBrowser(catalog, progress);

  return (
    <section className="mission-browser" aria-label="Mission browser">
      <h1 className="mission-browser__heading">Mission map</h1>
      <MissionBrowserToolbar browser={browser} />
      {browser.display === 'map' ? (
        <MissionMap items={browser.items} matchedIds={browser.matchedIds} onOpen={browser.openMission} />
      ) : (
        <MissionList
          items={browser.listItems}
          sort={browser.sort}
          hasActiveFilters={browser.activeFilterCount > 0}
          onOpen={browser.openMission}
          onClearFilters={browser.clearAllFilters}
        />
      )}
    </section>
  );
}
