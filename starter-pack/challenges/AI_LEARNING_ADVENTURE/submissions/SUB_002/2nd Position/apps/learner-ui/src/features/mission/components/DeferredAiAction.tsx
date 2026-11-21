import { useId } from 'react';
import type { AiContextPacket, MissionId } from '@ai-learning-adventure/types';
import { useAppDispatch } from '../../../store/index.ts';
import { openTutor } from '../../../store/aiSlice.ts';

export interface DeferredAiActionProps {
  label: string;
  className?: string;
  missionId?: MissionId;
  context?: AiContextPacket;
}

export function DeferredAiAction({ label, className, missionId, context }: DeferredAiActionProps) {
  const dispatch = useAppDispatch();
  const generatedId = useId().replace(/:/g, '');
  const triggerId = `ai-trigger-${generatedId}`;

  return (
    <span className="deferred-ai">
      <button
        type="button"
        id={triggerId}
        className={`button button--ghost button--small deferred-ai__trigger ${className ?? ''}`.trim()}
        onClick={() => dispatch(openTutor({ missionId, context, triggerId }))}
      >
        {label}
      </button>
    </span>
  );
}
