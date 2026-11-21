/**
 * Accessible slide-in panel used for the small-screen navigation drawer and other off-canvas
 * content. Shares the same focus-trap and Escape-to-close behaviour as Modal.
 */
import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { IconButton } from './IconButton';
import { XIcon } from './icons';
import { useFocusTrap } from './useFocusTrap';

export interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  side?: 'start' | 'end';
}

export function Drawer({ open, title, onClose, children, side = 'start' }: DrawerProps): ReactElement | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(panelRef, open, onClose);

  if (!open) {
    return null;
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return createPortal(
    <div className="drawer-backdrop" onMouseDown={handleBackdropClick}>
      <div ref={panelRef} className={`drawer drawer-${side}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="drawer-header">
          <h2 id={titleId} className="drawer-title">
            {title}
          </h2>
          <IconButton label="Close" icon={<XIcon />} onClick={onClose} />
        </header>
        <div className="drawer-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
