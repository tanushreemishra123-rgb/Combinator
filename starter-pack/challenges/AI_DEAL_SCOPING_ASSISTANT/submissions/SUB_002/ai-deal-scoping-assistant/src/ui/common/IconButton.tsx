/** An icon-only control. `label` is mandatory and becomes both the accessible name and the tooltip title. */
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  label: string;
  icon: ReactNode;
  variant?: 'ghost' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: IconButtonProps): ReactElement {
  const classes = ['icon-btn', `icon-btn-${variant}`, `icon-btn-${size}`, className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} aria-label={label} title={label} {...rest}>
      {icon}
    </button>
  );
}
