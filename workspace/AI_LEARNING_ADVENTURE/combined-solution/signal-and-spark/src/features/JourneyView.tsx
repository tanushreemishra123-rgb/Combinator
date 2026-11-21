import { ArrowRight, Award, Check, Clock3, LockKeyhole, Map, Send, TrendingUp } from 'lucide-react'
import type { LearningProgress, Mission } from '../types'
import { RouteIllustration, TutorGlyph } from '../components/Brand'
import { Button } from '../components/Ui'

const visibleMission = (mission: Mission) => mission.status === 'Published' && mission.enabled

export function JourneyView({
  missions,
  progress,
  onOpenMission,
  onOpenTutor,
}: {
  missions: Mission[]
  progress: LearningProgress
  onOpenMission: (missionId: string) => void
  onOpenTutor: (missionId: string, prompt?: string) => void
}) {
  const ordered = [...missions].sort((a, b) => a.order - b.order)
  const current = ordered.find((mission) => mission.id === progress.lastMissionId) ?? ordered.find(visibleMission)!
  const next = ordered.find((mission) => mission.order > current.order && visibleMission(mission))
  const completion = Math.round((progress.completedMissionIds.length / ordered.length) * 100)
  const latestBadge = progress.earnedBadges.at(-1) ?? 'First mission ahead'

  const nodeState = (mission: Mission) => {
    if (progress.completedMissionIds.includes(mission.id)) return 'complete'
    if (mission.id === current.id) return 'current'
    if (!visibleMission(mission) || mission.order > current.order) return 'locked'
    return 'available'
  }

  const submitTutor = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const prompt = String(form.get('journey-question') ?? '').trim()
    onOpenTutor(current.id, prompt)
  }

  return (
    <main className="journey-page page-shell">
      <section className="journey-hero">
        <div className="journey-copy">
          <h1>Your AI learning journey</h1>
          <p>Build practical AI confidence, one clear mission at a time.</p>
          <Button onClick={() => onOpenMission(current.id)}>
            Continue: {current.title} <ArrowRight size={19} />
          </Button>
        </div>
        <RouteIllustration />
      </section>

      <section className="progress-band" aria-label={`${progress.completedMissionIds.length} of ${ordered.length} missions complete`}>
        <strong>{progress.completedMissionIds.length} of {ordered.length} missions complete</strong>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${completion}%` }} />
        </div>
      </section>

      <div className="mission-map-scroll">
        <section className="mission-map" aria-label="Mission map">
          <div className="mission-path" aria-hidden="true" />
          {ordered.map((mission) => {
            const state = nodeState(mission)
            const disabled = state === 'locked'
            return (
              <button
                key={mission.id}
                className={`mission-node ${state}`}
                disabled={disabled}
                onClick={() => onOpenMission(mission.id)}
                aria-label={`${mission.order}. ${mission.title}, ${state}`}
              >
                <span className="mission-marker">
                  {state === 'complete' && <Check size={22} strokeWidth={2.4} />}
                  {state === 'current' && mission.order}
                  {state === 'locked' && <LockKeyhole size={18} />}
                  {state === 'available' && mission.order}
                </span>
                <span className="mission-order">{mission.order}</span>
                <span className="mission-title">{mission.title}</span>
                {state === 'current' && (
                  <span className="current-mission-card">
                    <strong>{mission.title}</strong>
                    <span>{mission.objective}</span>
                    <span className="mission-meta"><Clock3 size={16} /> {mission.duration} min <i /> <TrendingUp size={16} /> {mission.difficulty}</span>
                  </span>
                )}
              </button>
            )
          })}
        </section>
      </div>

      <section className="journey-actions">
        <form className="journey-tutor" onSubmit={submitTutor}>
          <TutorGlyph />
          <div className="journey-tutor-body">
            <label htmlFor="journey-question">Ask about this mission</label>
            <div className="input-with-action">
              <input id="journey-question" name="journey-question" placeholder={`Ask a question about ${current.title}…`} />
              <button type="submit" aria-label="Ask the mission tutor"><Send size={20} /></button>
            </div>
            <small>The local sample tutor uses only this mission’s committed content.</small>
          </div>
        </form>

        <button className="open-action next-action" onClick={() => next && onOpenMission(next.id)} disabled={!next}>
          <span className="round-icon"><ArrowRight size={26} /></span>
          <span><strong>{next ? `Next up: ${next.title}` : 'Journey complete'}</strong><small>{next ? 'Keep your momentum going.' : 'Review a mission to keep practicing.'}</small><b>{next ? 'See mission' : 'Review journey'} <ArrowRight size={16} /></b></span>
        </button>

        <button className="open-action achievement-action" onClick={() => onOpenMission(current.id)}>
          <span className="round-icon"><Award size={27} /></span>
          <span><em>Latest achievement</em><strong>{latestBadge}</strong><small>Earned through completed mission practice.</small><b>View achievement <ArrowRight size={16} /></b></span>
        </button>
      </section>

      <section className="journey-footer-band">
        <span>Stay curious, keep practicing, and enjoy the journey.</span>
        <button onClick={() => document.querySelector('.mission-map')?.scrollIntoView({ behavior: 'smooth' })}><Map size={19} /> View full mission map</button>
      </section>
    </main>
  )
}
