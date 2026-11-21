import { useCallback, useMemo } from 'react';
import type {
  CatalogDto,
  Difficulty,
  LevelTrack,
  MissionProgressStatus,
  ProgressSnapshotDto,
} from '@ai-learning-adventure/types';
import {
  countActiveFilters,
  deriveMissionAvailability,
  filterMissionBrowserItems,
  matchesMissionFilters,
  sortMissionBrowserItems,
  type MissionBrowserItem,
  type MissionSort,
} from '@ai-learning-adventure/learner';
import { useAppDispatch, useAppSelector } from '../../../store/index.ts';
import {
  clearFilters,
  selectMissionDisplay,
  selectMissionFilters,
  selectMissionSort,
  setMissionDisplay,
  setSort,
  toggleDifficulty,
  toggleStatus,
  toggleTrack,
  type MissionDisplay,
  type MissionFilters,
} from '../../../store/preferencesSlice.ts';
import { selectCurrentView } from '../../../store/navigationSlice.ts';
import { startMission } from '../../../store/missionSessionSlice.ts';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';

export interface UseMissionBrowserResult {
  items: MissionBrowserItem[];
  matchedIds: Set<string>;
  listItems: MissionBrowserItem[];
  display: MissionDisplay;
  filters: MissionFilters;
  sort: MissionSort;
  activeFilterCount: number;
  setDisplay: (display: MissionDisplay) => void;
  toggleDifficultyFilter: (difficulty: Difficulty) => void;
  toggleTrackFilter: (track: LevelTrack) => void;
  toggleStatusFilter: (status: MissionProgressStatus) => void;
  clearAllFilters: () => void;
  changeSort: (sort: MissionSort) => void;
  openMission: (item: MissionBrowserItem) => void;
}

export function useMissionBrowser(
  catalog: CatalogDto | undefined,
  progress: ProgressSnapshotDto | undefined,
): UseMissionBrowserResult {
  const dispatch = useAppDispatch();
  const { navigate, replace } = useAppNavigation();
  const display = useAppSelector(selectMissionDisplay);
  const filters = useAppSelector(selectMissionFilters);
  const sort = useAppSelector(selectMissionSort);
  const currentView = useAppSelector(selectCurrentView);

  const items = useMemo(
    () =>
      catalog !== undefined && progress !== undefined
        ? deriveMissionAvailability(catalog, progress)
        : [],
    [catalog, progress],
  );

  const matchedIds = useMemo(
    () =>
      new Set(
        items.filter((item) => matchesMissionFilters(item, filters)).map((item) => item.mission.id),
      ),
    [items, filters],
  );

  const listItems = useMemo(
    () => sortMissionBrowserItems(filterMissionBrowserItems(items, filters), sort),
    [items, filters, sort],
  );

  const activeFilterCount = countActiveFilters(filters);

  const setDisplay = useCallback(
    (next: MissionDisplay) => {
      dispatch(setMissionDisplay(next));
      if (currentView.kind === 'missions') {
        replace({ kind: 'missions', display: next });
      }
    },
    [dispatch, replace, currentView],
  );

  const toggleDifficultyFilter = useCallback(
    (difficulty: Difficulty) => dispatch(toggleDifficulty(difficulty)),
    [dispatch],
  );
  const toggleTrackFilter = useCallback(
    (track: LevelTrack) => dispatch(toggleTrack(track)),
    [dispatch],
  );
  const toggleStatusFilter = useCallback(
    (status: MissionProgressStatus) => dispatch(toggleStatus(status)),
    [dispatch],
  );
  const clearAllFilters = useCallback(() => dispatch(clearFilters()), [dispatch]);
  const changeSort = useCallback((next: MissionSort) => dispatch(setSort(next)), [dispatch]);

  const openMission = useCallback(
    (item: MissionBrowserItem) => {
      if (item.state === 'locked' || progress === undefined) return;
      const initialStep =
        item.status === 'in_progress'
          ? (progress.missions[item.mission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.furthestStep ?? 'lesson')
          : 'lesson';
      dispatch(
        startMission({
          missionId: item.mission.id,
          initialStep,
          startedAt: new Date().toISOString(),
        }),
      );
      navigate({ kind: 'mission', missionId: item.mission.id, step: initialStep });
    },
    [dispatch, navigate, progress],
  );

  return {
    items,
    matchedIds,
    listItems,
    display,
    filters,
    sort,
    activeFilterCount,
    setDisplay,
    toggleDifficultyFilter,
    toggleTrackFilter,
    toggleStatusFilter,
    clearAllFilters,
    changeSort,
    openMission,
  };
}
