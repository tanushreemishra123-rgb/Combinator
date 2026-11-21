/** Zoom controls for the diagram canvas: in, out and reset, with the current level announced for screen readers. */
import type { ReactElement } from 'react';
import { IconButton } from '../common';
import { MinusIcon, PlusIcon, RefreshIcon } from '../common/icons';

export interface DiagramToolbarProps {
  zoomPct: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function DiagramToolbar({ zoomPct, canZoomIn, canZoomOut, onZoomIn, onZoomOut, onReset }: DiagramToolbarProps): ReactElement {
  return (
    <div className="diagram-toolbar cluster" role="group" aria-label="Diagram zoom controls">
      <IconButton label="Zoom out" icon={<MinusIcon />} size="sm" disabled={!canZoomOut} onClick={onZoomOut} />
      <span className="diagram-zoom-level text-sm" aria-live="polite">
        {zoomPct}%
      </span>
      <IconButton label="Zoom in" icon={<PlusIcon />} size="sm" disabled={!canZoomIn} onClick={onZoomIn} />
      <IconButton label="Reset zoom" icon={<RefreshIcon />} size="sm" onClick={onReset} />
    </div>
  );
}
