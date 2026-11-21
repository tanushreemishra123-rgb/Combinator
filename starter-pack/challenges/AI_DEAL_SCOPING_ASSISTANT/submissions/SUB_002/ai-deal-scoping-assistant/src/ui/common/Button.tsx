/** Primary interactive control. Every workspace should build actions from this instead of a bare `<button>`. */
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner in place of the icon and disables the button while true. */
  busy?: boolean;
  icon?: ReactNode;
  iconPosition?: 'start' | 'end';
  fullWidth?: boolean;
  children: ReactNode;
}

interface IconPlacement {
  showStartIcon: boolean;
  showEndIcon: boolean;
}

function buttonClassName(variant: ButtonVariant, size: ButtonSize, fullWidth: boolean): string {
  const classes = ['btn', `btn-${variant}`, `btn-${size}`];
  if (fullWidth) {
    classes.push('btn-block');
  }
  return classes.join(' ');
}

/** An icon only ever shows on one side, and never while `busy` (the spinner takes its place). */
function resolveIconPlacement(busy: boolean, hasIcon: boolean, position: 'start' | 'end'): IconPlacement {
  const visible = !busy && hasIcon;
  return { showStartIcon: visible && position === 'start', showEndIcon: visible && position === 'end' };
}

export function Button({
  variant = 'primary',
  size = 'md',
  busy = false,
  icon,
  iconPosition = 'start',
  fullWidth = false,
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps): ReactElement {
  const classes = buttonClassName(variant, size, fullWidth);
  const { showStartIcon, showEndIcon } = resolveIconPlacement(busy, icon !== undefined, iconPosition);

  return (
    <button type={type} className={classes} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <Spinner size="sm" label="Working" /> : null}
      {showStartIcon ? (
        <span className="btn-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="btn-label">{children}</span>
      {showEndIcon ? (
        <span className="btn-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
    </button>
  );
}
