import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronDown, LockKeyhole, Send, Sparkles } from 'lucide-react'
import { TutorGlyph } from '../components/Brand'
import { StatusLabel } from '../components/Ui'
import { createTutorReply, type LearnerLevel } from '../lib/tutor'
import type { LearningProgress, Mission, TutorMessage } from '../types'

const createId = () => crypto.randomUUID()

export function TutorView({
  missions,
  progress,
  initialMissionId,
  initialPrompt,
}: {
  missions: Mission[]
  progress: LearningProgress
  initialMissionId?: string
  initialPrompt?: string
}) {
  const available = useMemo(() => missions.filter((mission) => mission.enabled && mission.status === 'Published'), [missions])
  const [missionId, setMissionId] = useState(initialMissionId ?? progress.lastMissionId ?? available[0]?.id)
  const [level, setLevel] = useState<LearnerLevel>('New to AI')
  const [messages, setMessages] = useState<TutorMessage[]>([])
  const seededPrompt = useRef(false)
  const mission = available.find((item) => item.id === missionId) ?? available[0]

  const ask = (input: string) => {
    if (!input.trim() || !mission) return
    const reply = createTutorReply({ mission, input, level, missions, progress })
    setMessages((current) => [
      ...current,
      { id: createId(), role: 'learner', text: input.trim() },
      { id: createId(), role: 'tutor', text: reply.text, source: reply.source },
    ])
  }

  useEffect(() => {
    if (initialPrompt && mission && !seededPrompt.current) {
      seededPrompt.current = true
      ask(initialPrompt)
    }
  }, [initialPrompt, mission])

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const input = String(data.get('tutor-question') ?? '')
    ask(input)
    event.currentTarget.reset()
  }

  if (!mission) return <main className="page-shell empty-page"><h1>AI Tutor</h1><p>Publish a mission to use the tutor.</p></main>

  return (
    <main className="page-shell tutor-page">
      <header className="tutor-page-heading">
        <div><div className="title-with-glyph"><TutorGlyph /><h1>AI Only Mode</h1></div><p>Ask questions, request examples, or choose what to learn next. Answers stay grounded in curated mission content.</p></div>
        <StatusLabel tone="teal">Local sample tutor</StatusLabel>
      </header>
      <div className="tutor-controls">
        <label><BookOpen size={18} /> Mission<span><select value={mission.id} onChange={(event) => { setMissionId(event.target.value); setMessages([]) }}>{available.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><ChevronDown size={17} /></span></label>
        <label>Learner level<span><select value={level} onChange={(event) => setLevel(event.target.value as LearnerLevel)}><option>New to AI</option><option>Some experience</option></select><ChevronDown size={17} /></span></label>
      </div>
      <section className="tutor-conversation" aria-live="polite">
        {messages.length === 0 ? (
          <div className="tutor-welcome"><TutorGlyph /><h2>What would you like to understand?</h2><p>I can explain {mission.title.toLowerCase()}, show an example, give a quiz hint, or recommend your next mission.</p><div className="quick-asks"><button onClick={() => ask('Explain it more simply')}>Explain it more simply</button><button onClick={() => ask('Show another example')}>Show another example</button><button onClick={() => ask('What should I learn next?')}>What should I learn next?</button></div></div>
        ) : (
          <div className="message-list">{messages.map((message) => <article key={message.id} className={`message ${message.role}`}><strong>{message.role === 'learner' ? 'You' : 'Sample mission tutor'}</strong><p>{message.text}</p>{message.source && <small>{message.source}</small>}</article>)}</div>
        )}
      </section>
      <form className="tutor-composer" onSubmit={submit}>
        <label htmlFor="tutor-question">Ask about {mission.title}</label>
        <div><textarea id="tutor-question" name="tutor-question" rows={2} placeholder="Ask for an explanation, example, hint, or recommendation…" /><button aria-label="Send question"><Send size={20} /></button></div>
        <small><LockKeyhole size={14} /> Local fallback mode: sample responses retrieve only committed mission content and send no data to an external service.</small>
      </form>
    </main>
  )
}
