import { useEffect } from 'react';
import { useFocusReturn } from '../../../hooks/ui/useFocusReturn.ts';
import type { UseAiOnlySessionResult } from '../hooks/useAiOnlySession.ts';
import { AiOnlyScopeRail } from './AiOnlyScopeRail.tsx';

export interface AiOnlyScopeSheetProps {
  open: boolean;
  session: UseAiOnlySessionResult;
  onClose: () => void;
}

export function AiOnlyScopeSheet({ open, session, onClose }: AiOnlyScopeSheetProps) {
  const { overlayRef } = useFocusReturn<HTMLDivElement>({
    open,
    triggerId: 'ai-only-open-scope',
    trapFocus: true,
  });

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="ai-only-sheet-backdrop" onMouseDown={onClose}>
      <div
        ref={overlayRef}
        className="ai-only-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-only-scope-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ai-only-sheet__header">
          <h2 id="ai-only-scope-sheet-title">Choose learning content</h2>
          <button type="button" className="button button--ghost button--small" onClick={onClose}>
            Close
          </button>
        </div>
        <AiOnlyScopeRail session={session} onSelect={onClose} />
      </div>
    </div>
  );
}
