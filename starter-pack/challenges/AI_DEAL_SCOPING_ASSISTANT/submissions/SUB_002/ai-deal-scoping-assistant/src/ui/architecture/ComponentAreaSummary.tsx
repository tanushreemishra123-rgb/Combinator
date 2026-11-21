/** All 14 architecture areas with a component count, so a gap (zero components in an applicable area) is visible at a glance and doubles as the card grid's filter. */
import type { ReactElement } from 'react';
import type { ArchitectureArea } from '../../domain';
import { Badge } from '../common';
import type { AreaCount } from './areaInfo';

export interface ComponentAreaSummaryProps {
  areas: AreaCount[];
  activeArea: ArchitectureArea | null;
  onSelectArea: (area: ArchitectureArea | null) => void;
}

function chipClassName(active: boolean, isGap: boolean): string {
  const classes = ['area-filter-chip', active ? 'area-filter-chip-active' : '', isGap ? 'area-filter-chip-gap' : ''];
  return classes.filter((value) => value.length > 0).join(' ');
}

export function ComponentAreaSummary({ areas, activeArea, onSelectArea }: ComponentAreaSummaryProps): ReactElement {
  const total = areas.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <div className="architecture-area-summary" role="group" aria-label="Filter components by architecture area">
      <button type="button" className={chipClassName(activeArea === null, false)} aria-pressed={activeArea === null} onClick={() => onSelectArea(null)}>
        All areas
        <Badge tone="neutral">{total}</Badge>
      </button>
      {areas.map((entry) => (
        <button
          key={entry.area}
          type="button"
          className={chipClassName(activeArea === entry.area, entry.count === 0)}
          aria-pressed={activeArea === entry.area}
          onClick={() => onSelectArea(entry.area)}
        >
          {entry.label}
          <Badge tone={entry.count === 0 ? 'warning' : 'neutral'}>{entry.count}</Badge>
        </button>
      ))}
    </div>
  );
}
