import { Sparkles } from 'lucide-react'

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="Signal & Spark home">
      <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="22" cy="24" r="16" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M22 2v44M2 24h40" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="m28.5 13-3.9 13.1L15.5 35l3.9-13.1L28.5 13Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="22" cy="24" r="2.4" fill="currentColor" />
        <path d="m38 3 1.3 3.2L42.5 7.5l-3.2 1.3L38 12l-1.3-3.2-3.2-1.3 3.2-1.3L38 3Z" fill="var(--coral)" stroke="none" />
      </svg>
      {!compact && <span>Signal &amp; Spark</span>}
    </div>
  )
}

export function RouteIllustration({ small = false }: { small?: boolean }) {
  return (
    <svg className={small ? 'route-illustration small' : 'route-illustration'} viewBox="0 0 520 190" aria-hidden="true">
      <path d="M15 157c55 0 92-7 139-24 50-19 88-31 132-27 64 6 77-10 116-34" fill="none" stroke="var(--navy)" strokeWidth="3" strokeLinecap="round" />
      <path d="M235 105 292 43l41 42 30-26 48 49" fill="none" stroke="var(--border-strong)" strokeWidth="3" strokeLinejoin="round" />
      <path d="m275 62 17-19 12 13" fill="none" stroke="var(--border-strong)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M405 75c-42 9-74 31-56 47 17 16 62-6 82 13 17 16-10 37-32 44" fill="none" stroke="var(--navy)" strokeWidth="3" strokeLinecap="round" />
      <path d="M404 31v48m0-44c20 1 25 14 44 8-7 12-21 15-44 8" fill="none" stroke="var(--navy)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M406 36c18 2 23 12 38 8-7 9-19 11-38 6Z" fill="var(--coral)" stroke="none" />
      <path d="m482 119 11-21 11 21h-7l8 16h-9v24h-6v-24h-9l8-16h-7Z" fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinejoin="round" />
      <path d="m88 146 10-18 10 18h-6l7 13h-8v18h-6v-18h-8l7-13h-6Z" fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinejoin="round" />
      <path d="m334 22 2.7 6.3 6.3 2.7-6.3 2.7-2.7 6.3-2.7-6.3-6.3-2.7 6.3-2.7 2.7-6.3Zm-22 18 1.6 3.8 3.8 1.6-3.8 1.6-1.6 3.8-1.6-3.8-3.8-1.6 3.8-1.6L312 40Z" fill="var(--coral)" />
    </svg>
  )
}

export function TutorGlyph() {
  return (
    <span className="tutor-glyph" aria-hidden="true">
      <span className="tutor-face">••</span>
      <Sparkles size={14} />
    </span>
  )
}
