import { useState } from 'react';
import type { MissionSort } from '@ai-learning-adventure/learner';
import type { MissionDisplay } from '../../../store/preferencesSlice.ts';
import { MapListToggle } from './MapListToggle.tsx';
import { MissionFilterBar } from './MissionFilterBar.tsx';
import type { UseMissionBrowserResult } from '../hooks/useMissionBrowser.ts';

const SORT_LABELS: Record<MissionSort, string> = {
  track_order: 'Track order',
  title: 'Title',
  difficulty: 'Difficulty',
  progress: 'Progress',
};

export interface MissionBrowserToolbarProps {
  browser: UseMissionBrowserResult;
}

export function MissionBrowserToolbar({ browser }: MissionBrowserToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { display, sort, filters, activeFilterCount } = browser;

  return (
    <div className="mission-toolbar">
      <div className="mission-toolbar__row">
        <MapListToggle display={display} onChange={browser.setDisplay} />
        <button
          type="button"
          className="mission-toolbar__filters-toggle"
          aria-expanded={filtersOpen}
          aria-controls="mission-filter-panel"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
        {display === 'list' && (
          <label className="mission-toolbar__sort">
            <span>Sort by</span>
            <select
              value={sort}
              onChange={(event) => browser.changeSort(event.target.value as MissionSort)}
            >
              {(Object.keys(SORT_LABELS) as MissionSort[]).map((value) => (
                <option key={value} value={value}>
                  {SORT_LABELS[value] /* nosemgrep: gitlab.eslint.detect-object-injection */}
                </option>
              ))}
            </select>
          </label>
        )}
        {activeFilterCount > 0 && (
          <button type="button" className="mission-toolbar__clear" onClick={browser.clearAllFilters}>
            Clear all ({activeFilterCount})
          </button>
        )}
      </div>
      <div
        id="mission-filter-panel"
        className="mission-toolbar__panel"
        data-open={filtersOpen ? 'true' : 'false'}
      >
        <MissionFilterBar
          filters={filters}
          onToggleDifficulty={browser.toggleDifficultyFilter}
          onToggleTrack={browser.toggleTrackFilter}
          onToggleStatus={browser.toggleStatusFilter}
        />
      </div>
    </div>
  );
}
