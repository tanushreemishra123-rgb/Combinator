import {
  DIFFICULTY_LABELS,
  DIFFICULTY_SEQUENCE,
  LEVEL_TRACK_LABELS,
  LEVEL_TRACK_SEQUENCE,
  MISSION_STATUS_LABELS,
  MISSION_STATUS_SEQUENCE,
} from '@ai-learning-adventure/learner';
import type { MissionFilters } from '../../../store/preferencesSlice.ts';

export interface MissionFilterBarProps {
  filters: MissionFilters;
  onToggleDifficulty: (value: (typeof DIFFICULTY_SEQUENCE)[number]) => void;
  onToggleTrack: (value: (typeof LEVEL_TRACK_SEQUENCE)[number]) => void;
  onToggleStatus: (value: (typeof MISSION_STATUS_SEQUENCE)[number]) => void;
}

interface ChipGroupProps<T extends string> {
  legend: string;
  options: readonly T[];
  labels: Record<T, string>;
  selected: readonly T[];
  onToggle: (value: T) => void;
  idPrefix: string;
}

function ChipGroup<T extends string>({ legend, options, labels, selected, onToggle, idPrefix }: ChipGroupProps<T>) {
  return (
    <fieldset className="filter-group">
      <legend className="filter-group__legend">{legend}</legend>
      <div className="filter-group__chips">
        {options.map((option) => {
          const pressed = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              id={`${idPrefix}-${option}`}
              className="filter-chip"
              aria-pressed={pressed}
              onClick={() => onToggle(option)}
            >
              {labels[option] /* nosemgrep: gitlab.eslint.detect-object-injection */}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function MissionFilterBar({
  filters,
  onToggleDifficulty,
  onToggleTrack,
  onToggleStatus,
}: MissionFilterBarProps) {
  return (
    <div className="mission-filter-bar">
      <ChipGroup
        legend="Difficulty"
        options={DIFFICULTY_SEQUENCE}
        labels={DIFFICULTY_LABELS}
        selected={filters.difficulties}
        onToggle={onToggleDifficulty}
        idPrefix="filter-difficulty"
      />
      <ChipGroup
        legend="Level track"
        options={LEVEL_TRACK_SEQUENCE}
        labels={LEVEL_TRACK_LABELS}
        selected={filters.tracks}
        onToggle={onToggleTrack}
        idPrefix="filter-track"
      />
      <ChipGroup
        legend="Status"
        options={MISSION_STATUS_SEQUENCE}
        labels={MISSION_STATUS_LABELS}
        selected={filters.statuses}
        onToggle={onToggleStatus}
        idPrefix="filter-status"
      />
    </div>
  );
}
