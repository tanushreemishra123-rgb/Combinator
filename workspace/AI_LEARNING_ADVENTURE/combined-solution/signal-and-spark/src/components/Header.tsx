import { ArrowRight, BarChart3, BookOpen, MessageSquare, PencilLine } from 'lucide-react'
import type { LearnerView } from '../types'
import { BrandMark } from './Brand'

const items: Array<{ view: LearnerView; label: string; Icon: typeof BookOpen }> = [
  { view: 'journey', label: 'Journey', Icon: BookOpen },
  { view: 'practice', label: 'Practice', Icon: PencilLine },
  { view: 'tutor', label: 'AI Tutor', Icon: MessageSquare },
  { view: 'progress', label: 'Progress', Icon: BarChart3 },
]

export function Header({
  active,
  onNavigate,
  onContinue,
}: {
  active: LearnerView
  onNavigate: (view: LearnerView) => void
  onContinue: () => void
}) {
  return (
    <header className="app-header">
      <button className="brand-button" onClick={() => onNavigate('journey')}>
        <BrandMark />
      </button>
      <nav className="primary-nav" aria-label="Primary navigation">
        {items.map(({ view, label, Icon }) => (
          <button
            key={view}
            className={active === view || (view === 'journey' && active === 'mission') ? 'nav-item active' : 'nav-item'}
            aria-current={active === view ? 'page' : undefined}
            onClick={() => onNavigate(view)}
          >
            <Icon size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <button className="button primary header-continue" onClick={onContinue}>
        Continue learning <ArrowRight size={18} />
      </button>
    </header>
  )
}
