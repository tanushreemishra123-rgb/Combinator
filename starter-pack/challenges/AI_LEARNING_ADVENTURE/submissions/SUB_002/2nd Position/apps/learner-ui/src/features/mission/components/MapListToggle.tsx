import type { MissionDisplay } from '../../../store/preferencesSlice.ts';

export interface MapListToggleProps {
  display: MissionDisplay;
  onChange: (display: MissionDisplay) => void;
}

export function MapListToggle({ display, onChange }: MapListToggleProps) {
  return (
    <div className="map-list-toggle" role="group" aria-label="Mission view">
      <button
        type="button"
        id="mission-display-map"
        className="map-list-toggle__option"
        aria-pressed={display === 'map'}
        onClick={() => onChange('map')}
      >
        Map
      </button>
      <button
        type="button"
        id="mission-display-list"
        className="map-list-toggle__option"
        aria-pressed={display === 'list'}
        onClick={() => onChange('list')}
      >
        List
      </button>
    </div>
  );
}
