import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  children: ReactNode
}) {
  return (
    <button className={`button ${variant} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}

export function StatusLabel({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'teal' | 'coral' | 'neutral' | 'blue' }) {
  return <span className={`status-label ${tone}`}>{children}</span>
}

export function ScreenReaderText({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>
}
