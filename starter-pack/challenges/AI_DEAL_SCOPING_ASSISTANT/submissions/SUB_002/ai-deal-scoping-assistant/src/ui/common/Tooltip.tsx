/**
 * Accessible tooltip: shows `content` on hover and on keyboard focus (never hover-only, so
 * keyboard users get the same information), linked to the trigger via `aria-describedby`.
 */
import { cloneElement, useId, useState } from 'react';
import type { ReactElement } from 'react';

export interface TooltipProps {
  content: string;
  /** A single element that can receive focus (or already does), e.g. a badge with tabIndex={0}. */
  children: ReactElement<{ 'aria-describedby'?: string }>;
}

export function Tooltip({ content, children }: TooltipProps): ReactElement {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  function show(): void {
    setVisible(true);
  }

  function hide(): void {
    setVisible(false);
  }

  return (
    <span className="tooltip-wrapper" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {cloneElement(children, { 'aria-describedby': tooltipId })}
      {visible ? (
        <span role="tooltip" id={tooltipId} className="tooltip-bubble">
          {content}
        </span>
      ) : null}
    </span>
  );
}
