import { useCallback, useMemo, useRef, useState } from 'react';
import type { LevelTrack } from '@ai-learning-adventure/types';
import { LEVEL_TRACK_LABELS, LEVEL_TRACK_SEQUENCE, type MissionBrowserItem } from '@ai-learning-adventure/learner';
import { MissionNode } from './MissionNode.tsx';

export interface MissionMapProps {
  items: MissionBrowserItem[];
  matchedIds: Set<string>;
  onOpen: (item: MissionBrowserItem) => void;
}

interface TrackBand {
  track: LevelTrack;
  items: MissionBrowserItem[];
}

export function MissionMap({ items, matchedIds, onOpen }: MissionMapProps) {
  const nodeRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const bands = useMemo<TrackBand[]>(
    () =>
      LEVEL_TRACK_SEQUENCE.map((track) => ({
        track,
        items: items.filter((item) => item.mission.levelTrack === track),
      })).filter((band) => band.items.length > 0),
    [items],
  );

  const focusNode = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, nodeRefs.current.length - 1));
    setFocusedIndex(clamped);
    nodeRefs.current[clamped]?.focus();
  }, []);

  const handleKeyNavigate = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          focusNode(index + 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          focusNode(index - 1);
          break;
        case 'Home':
          event.preventDefault();
          focusNode(0);
          break;
        case 'End':
          event.preventDefault();
          focusNode(nodeRefs.current.length - 1);
          break;
        default:
          break;
      }
    },
    [focusNode],
  );

  if (items.length === 0) {
    return <p className="mission-map__empty">No missions are available yet.</p>;
  }

  let nodeIndex = -1;

  return (
    <div className="mission-map" aria-label="Mission map">
      {bands.map((band) => (
        <section
          key={band.track}
          className={`mission-map__band mission-map__band--${band.track}`}
          aria-label={`${LEVEL_TRACK_LABELS[band.track] /* nosemgrep: gitlab.eslint.detect-object-injection */} track`}
        >
          <span className="mission-map__band-label">{LEVEL_TRACK_LABELS[band.track] /* nosemgrep: gitlab.eslint.detect-object-injection */}</span>
          <ol className="mission-map__path">
            {band.items.map((item) => {
              nodeIndex += 1;
              const index = nodeIndex;
              return (
                <MissionNode
                  key={item.mission.id}
                  item={item}
                  isDimmed={!matchedIds.has(item.mission.id)}
                  isTabStop={index === Math.min(focusedIndex, items.length - 1)}
                  onOpen={onOpen}
                  onKeyNavigate={(event) => handleKeyNavigate(event, index)}
                  registerRef={(element) => {
                    nodeRefs.current[index] = element;
                  }}
                />
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
