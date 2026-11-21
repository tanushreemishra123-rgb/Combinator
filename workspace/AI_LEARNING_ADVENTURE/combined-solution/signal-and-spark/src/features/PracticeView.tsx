import { useMemo, useState } from 'react'
import { ArrowRight, Check, CheckCircle2, Layers3, PencilLine, RotateCcw } from 'lucide-react'
import { Button } from '../components/Ui'
import type { Mission } from '../types'

export function PracticeView({ missions }: { missions: Mission[] }) {
  const available = useMemo(() => missions.filter((mission) => mission.enabled && mission.status === 'Published'), [missions])
  const [missionId, setMissionId] = useState(available[0]?.id ?? '')
  const [mode, setMode] = useState<'quiz' | 'cards'>('quiz')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answer, setAnswer] = useState<number | null>(null)
  const [cardIndex, setCardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const mission = available.find((item) => item.id === missionId) ?? available[0]
  const question = mission?.questions.at(questionIndex % mission.questions.length)
  const card = mission?.flashcards.at(cardIndex % mission.flashcards.length)

  const selectMission = (id: string) => {
    setMissionId(id)
    setQuestionIndex(0)
    setAnswer(null)
    setCardIndex(0)
    setFlipped(false)
  }

  if (!mission) return <main className="page-shell empty-page"><h1>Practice</h1><p>Publish a mission to start practicing.</p></main>

  return (
    <main className="page-shell practice-page">
      <header className="section-hero compact-hero">
        <div><h1>Practice what you learned</h1><p>Use checkpoints and flashcards to strengthen one idea at a time.</p></div>
        <PencilLine size={52} strokeWidth={1.4} />
      </header>
      <div className="practice-toolbar">
        <label>Mission<select value={mission.id} onChange={(event) => selectMission(event.target.value)}>{available.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <div className="segmented-control" aria-label="Practice mode">
          <button className={mode === 'quiz' ? 'active' : ''} onClick={() => setMode('quiz')}><CheckCircle2 size={18} /> Quiz</button>
          <button className={mode === 'cards' ? 'active' : ''} onClick={() => setMode('cards')}><Layers3 size={18} /> Flashcards</button>
        </div>
      </div>

      {mode === 'quiz' && question && (
        <section className="practice-stage">
          <div className="practice-stage-heading"><span>Question {questionIndex + 1} of {mission.questions.length}</span><strong>{question.reviewTopic}</strong></div>
          <h2>{question.prompt}</h2>
          <div className="answer-list">
            {question.options.map((option, index) => {
              const chosen = answer === index
              const correct = answer !== null && index === question.correctIndex
              return <button key={option} className={`answer-option ${chosen ? 'chosen' : ''} ${correct ? 'correct' : ''} ${chosen && !correct ? 'wrong' : ''}`} disabled={answer !== null} onClick={() => setAnswer(index)}><span className="radio-mark">{correct && <Check size={14} />}</span><span>{option}</span>{correct && <Check size={20} />}</button>
            })}
          </div>
          {answer !== null && <div className={`answer-feedback ${answer === question.correctIndex ? 'success' : 'retry'}`}><CheckCircle2 size={27} /><span><strong>{answer === question.correctIndex ? 'Correct' : 'Review this idea'}</strong>{question.explanation}</span></div>}
          <div className="practice-stage-actions">
            <Button variant="secondary" onClick={() => { setQuestionIndex(0); setAnswer(null) }}><RotateCcw size={18} /> Start over</Button>
            <Button disabled={answer === null} onClick={() => { setQuestionIndex((index) => (index + 1) % mission.questions.length); setAnswer(null) }}>Next question <ArrowRight size={18} /></Button>
          </div>
        </section>
      )}

      {mode === 'cards' && card && (
        <section className="practice-stage cards-stage">
          <div className="practice-stage-heading"><span>Card {cardIndex + 1} of {mission.flashcards.length}</span><strong>{mission.title}</strong></div>
          <button className={`flashcard large ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((value) => !value)}>
            {!flipped ? <><small>Concept</small><strong>{card.term}</strong><span>Tap to reveal</span></> : <><small>{card.term}</small><strong>{card.definition}</strong><span><b>Example:</b> {card.example}</span><span><b>Watch for:</b> {card.commonMistake}</span></>}
          </button>
          <div className="practice-stage-actions"><Button variant="secondary" disabled={cardIndex === 0} onClick={() => { setCardIndex((index) => index - 1); setFlipped(false) }}>Previous</Button><Button onClick={() => { setCardIndex((index) => (index + 1) % mission.flashcards.length); setFlipped(false) }}>Next card <ArrowRight size={18} /></Button></div>
        </section>
      )}
    </main>
  )
}
