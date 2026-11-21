/** Accessible modal dialog: focus trap, Escape to close, click-outside to close, portalled to `document.body`. */
import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { IconButton } from './IconButton';
import { XIcon } from './icons';
import { useFocusTrap } from './useFocusTrap';

export interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, title, description, onClose, children, footer, size = 'md' }: ModalProps): ReactElement | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useFocusTrap(dialogRef, open, onClose);

  if (!open) {
    return null;
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={handleBackdropClick}>
      <div
        ref={dialogRef}
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header className="modal-header">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          <IconButton label="Close dialog" icon={<XIcon />} onClick={onClose} />
        </header>
        {description ? (
          <p id={descriptionId} className="modal-description text-muted">
            {description}
          </p>
        ) : null}
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
