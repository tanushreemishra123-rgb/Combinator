import { ArrowRight, Award, BarChart3, CheckCircle2, RotateCcw } from 'lucide-react'
import { Button } from '../components/Ui'
import type { LearningProgress, Mission } from '../types'

export function ProgressView({ missions, progress, onOpenMission, onReset }: { missions: Mission[]; progress: LearningProgress; onOpenMission: (id: string) => void; onReset: () => void }) {
  const completed = missions.filter((mission) => progress.completedMissionIds.includes(mission.id))
  const published = missions.filter((mission) => mission.enabled && mission.status === 'Published')
  const next = published.find((mission) => !progress.completedMissionIds.includes(mission.id))
  const percent = Math.round((completed.length / missions.length) * 100)
  const currentLevel = next?.difficulty ?? completed.at(-1)?.difficulty ?? 'Beginner'
  const resultByMissionId = new Map(Object.entries(progress.results))
  return (
    <main className="page-shell progress-page">
      <header className="section-hero compact-hero"><div><h1>Your progress</h1><p>See what you completed, revisit weak topics, and choose the next clear step.</p></div><BarChart3 size={52} strokeWidth={1.4} /></header>
      <section className="progress-overview">
        <div className="progress-ring" style={{ '--progress': `${percent * 3.6}deg` } as React.CSSProperties}><span><strong>{percent}%</strong>journey complete</span></div>
        <div><span className="current-level">Current level · {currentLevel}</span><h2>{completed.length} missions complete</h2><p>You have earned {progress.earnedBadges.length} milestones across {missions.length} curated missions.</p>{next && <Button onClick={() => onOpenMission(next.id)}>Continue: {next.title} <ArrowRight size={18} /></Button>}</div>
      </section>
      <div className="progress-columns">
        <section className="progress-list"><h2>Mission results</h2>{missions.map((mission) => { const result = resultByMissionId.get(mission.id); const done = progress.completedMissionIds.includes(mission.id); return <button key={mission.id} onClick={() => onOpenMission(mission.id)} disabled={!mission.enabled || mission.status !== 'Published'}><span className={done ? 'result-icon done' : 'result-icon'}>{done ? <CheckCircle2 size={21} /> : mission.order}</span><span><strong>{mission.title}</strong><small>{mission.difficulty}</small></span><b>{result ? `${result.correct}/${result.total}` : done ? 'Complete' : 'Not started'}</b><ArrowRight size={17} /></button> })}</section>
        <section className="badge-list"><h2>Milestones</h2>{progress.earnedBadges.map((badge) => <div key={badge}><Award size={24} /><span><strong>{badge}</strong><small>Earned through mission practice</small></span></div>)}</section>
      </div>
      <div className="reset-demo"><span><strong>Want a fresh walkthrough?</strong><small>Reset only this browser’s local demo content and progress.</small></span><Button variant="secondary" onClick={onReset}><RotateCcw size={18} /> Reset demo</Button></div>
    </main>
  )
}
