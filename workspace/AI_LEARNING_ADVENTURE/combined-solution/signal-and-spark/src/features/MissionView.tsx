import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  CopyCheck,
  Layers3,
  LockKeyhole,
  MessageSquare,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react'
import { RouteIllustration, TutorGlyph } from '../components/Brand'
import { Button } from '../components/Ui'
import { createTutorReply } from '../lib/tutor'
import type { LearningProgress, Mission } from '../types'

const stepLabels = ['Learn', 'Try', 'Checkpoint', 'Review', 'Complete']

export function MissionView({
  mission,
  missions,
  progress,
  onBack,
  onComplete,
}: {
  mission: Mission
  missions: Mission[]
  progress: LearningProgress
  onBack: () => void
  onComplete: (mission: Mission, correct: number) => void
}) {
  const [step, setStep] = useState(1)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [answeredIds, setAnsweredIds] = useState<string[]>([])
  const [cardIndex, setCardIndex] = useState(0)
  const [cardFlipped, setCardFlipped] = useState(false)
  const [tutorText, setTutorText] = useState('')
  const [tutorSource, setTutorSource] = useState(`Mission: ${mission.title}`)
  const question = mission.questions.at(questionIndex)
  const card = mission.flashcards.at(cardIndex)
  const isCorrect = selected === question?.correctIndex

  const completedBefore = progress.completedMissionIds.includes(mission.id)
  const scoreLabel = useMemo(() => {
    const total = mission.questions.length
    return `${correctCount} of ${total}`
  }, [correctCount, mission.questions.length])

  const askTutor = (input: string) => {
    const reply = createTutorReply({
      mission,
      input,
      level: 'New to AI',
      currentQuestion: step === 3 ? question : undefined,
      missions,
      progress,
    })
    setTutorText(reply.text)
    setTutorSource(reply.source)
  }

  const submitTutor = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const input = String(data.get('mission-tutor-input') ?? '').trim()
    if (!input) return
    askTutor(input)
    event.currentTarget.reset()
  }

  const chooseAnswer = (index: number) => {
    if (selected !== null || !question) return
    setSelected(index)
    setAnsweredIds((current) => [...current, question.id])
    if (index === question.correctIndex) setCorrectCount((count) => count + 1)
  }

  const continueCheckpoint = () => {
    if (selected === null) return
    if (questionIndex < mission.questions.length - 1) {
      setQuestionIndex((index) => index + 1)
      setSelected(null)
      setTutorText('')
    } else {
      setStep(4)
    }
  }

  const restartQuiz = () => {
    setQuestionIndex(0)
    setSelected(null)
    setCorrectCount(0)
    setAnsweredIds([])
    setStep(3)
  }

  const finishMission = () => {
    onComplete(mission, correctCount)
  }

  return (
    <main className="mission-page page-shell">
      <div className="mission-heading-row">
        <div>
          <button className="breadcrumb" onClick={onBack}><ArrowLeft size={16} /> Journey <span>/</span> Mission {mission.order}</button>
          <h1>{mission.title}</h1>
          <p>{mission.objective}</p>
        </div>
        <RouteIllustration small />
      </div>

      <div className="mission-workspace">
        <section className="learning-column">
          <div className="stepper" aria-label={`Step ${step} of 5`}>
            <strong>Step {step} of 5</strong>
            <ol>
              {stepLabels.map((label, index) => {
                const number = index + 1
                return (
                  <li key={label} className={number < step ? 'done' : number === step ? 'current' : ''}>
                    <button onClick={() => number <= step && setStep(number)} aria-label={`${label}, step ${number}`}>
                      {number < step ? <Check size={17} /> : number}
                    </button>
                    <span>{label}</span>
                  </li>
                )
              })}
            </ol>
          </div>

          {step === 1 && (
            <section className="lesson-canvas">
              <div className="section-title"><BookOpen size={23} /><span>Lesson</span></div>
              <h2>{mission.lessonTitle}</h2>
              <p>{mission.lesson}</p>
              <div className="objective-callout">
                <CheckCircle2 size={22} />
                <span><strong>Learning objective</strong>{mission.objective}</span>
              </div>
              <div className="canvas-actions"><span /><Button onClick={() => setStep(2)}>Try an example <ArrowRight size={18} /></Button></div>
            </section>
          )}

          {step === 2 && (
            <section className="lesson-canvas">
              <div className="section-title"><Sparkles size={23} /><span>Try this pattern</span></div>
              <h2>Make the instruction specific</h2>
              <p className="example-block">{mission.example}</p>
              <label className="field-label" htmlFor="practice-prompt">Write your own version</label>
              <textarea id="practice-prompt" rows={5} defaultValue={`Explain ${mission.title.toLowerCase()} to a colleague using three clear examples.`} />
              <div className="prompt-checklist">
                <span><Check size={17} /> Task</span><span><Check size={17} /> Audience</span><span><Check size={17} /> Format</span><span><CircleHelp size={17} /> Constraint</span>
              </div>
              <div className="canvas-actions"><Button variant="secondary" onClick={() => askTutor('Show another example')}>Ask for an example</Button><Button onClick={() => setStep(3)}>Start checkpoint <ArrowRight size={18} /></Button></div>
            </section>
          )}

          {step === 3 && question && (
            <section className="lesson-canvas checkpoint-canvas">
              <div className="section-title"><BookOpen size={23} /><span>Lesson</span></div>
              <h2>{mission.lessonTitle}</h2>
              <p>{mission.lesson}</p>
              <div className="example-pattern"><strong>Try this pattern</strong><span>{mission.example}</span></div>

              <div className="checkpoint-heading">
                <span><CheckCircle2 size={23} /> Checkpoint</span>
                <small>{questionIndex + 1} / {mission.questions.length}</small>
              </div>
              <h3>{question.prompt}</h3>
              <div className="answer-list" role="radiogroup" aria-label={question.prompt}>
                {question.options.map((option, index) => {
                  const chosen = selected === index
                  const correct = selected !== null && index === question.correctIndex
                  const wrong = chosen && !correct
                  return (
                    <button
                      key={option}
                      className={`answer-option ${chosen ? 'chosen' : ''} ${correct ? 'correct' : ''} ${wrong ? 'wrong' : ''}`}
                      onClick={() => chooseAnswer(index)}
                      disabled={selected !== null}
                      role="radio"
                      aria-checked={chosen}
                    >
                      <span className="radio-mark">{correct && <Check size={14} />}</span>
                      <span>{option}</span>
                      {correct && <Check size={20} />}
                    </button>
                  )
                })}
              </div>
              {selected !== null && (
                <div className={`answer-feedback ${isCorrect ? 'success' : 'retry'}`} role="status">
                  {isCorrect ? <CheckCircle2 size={28} /> : <RotateCcw size={27} />}
                  <span><strong>{isCorrect ? 'That works' : 'Review this idea'}</strong>{question.explanation}</span>
                </div>
              )}
              <div className="canvas-actions checkpoint-actions">
                <Button variant="secondary" onClick={() => setStep(4)}><Layers3 size={18} /> Review flashcards</Button>
                <Button onClick={continueCheckpoint} disabled={selected === null}>
                  {questionIndex < mission.questions.length - 1 ? 'Next question' : 'Continue mission'} <ArrowRight size={18} />
                </Button>
              </div>
            </section>
          )}

          {step === 4 && card && (
            <section className="lesson-canvas flashcard-canvas">
              <div className="section-title"><Layers3 size={23} /><span>Flashcard review</span></div>
              <h2>Strengthen the ideas you just used</h2>
              <button className={`flashcard ${cardFlipped ? 'flipped' : ''}`} onClick={() => setCardFlipped((value) => !value)}>
                {!cardFlipped ? (
                  <><small>Concept {cardIndex + 1} of {mission.flashcards.length}</small><strong>{card.term}</strong><span>Tap to reveal</span></>
                ) : (
                  <><small>{card.term}</small><strong>{card.definition}</strong><span><b>Example:</b> {card.example}</span><span><b>Watch for:</b> {card.commonMistake}</span></>
                )}
              </button>
              <div className="flashcard-controls">
                <Button variant="secondary" disabled={cardIndex === 0} onClick={() => { setCardIndex((index) => index - 1); setCardFlipped(false) }}>Previous</Button>
                <span>{cardIndex + 1} / {mission.flashcards.length}</span>
                {cardIndex < mission.flashcards.length - 1 ? (
                  <Button onClick={() => { setCardIndex((index) => index + 1); setCardFlipped(false) }}>Next card <ArrowRight size={18} /></Button>
                ) : (
                  <Button onClick={() => setStep(5)}>Finish review <ArrowRight size={18} /></Button>
                )}
              </div>
            </section>
          )}

          {step === 5 && (
            <section className="lesson-canvas completion-canvas">
              <span className="completion-icon"><CopyCheck size={42} /></span>
              <h2>{completedBefore ? 'Mission reviewed' : 'Mission complete'}</h2>
              <p>You worked through the lesson, examples, checkpoint, and review cards.</p>
              <div className="completion-summary">
                <span><strong>{scoreLabel}</strong>checkpoint answers correct</span>
                <span><strong>{mission.badge}</strong>milestone earned</span>
                <span><strong>{answeredIds.length}</strong>questions attempted</span>
              </div>
              <div className="canvas-actions"><Button variant="secondary" onClick={restartQuiz}><RotateCcw size={18} /> Retry checkpoint</Button><Button onClick={finishMission}>Save progress <ArrowRight size={18} /></Button></div>
            </section>
          )}
        </section>

        <aside className="mission-tutor-rail" aria-label="Mission tutor">
          <div className="tutor-rail-heading"><TutorGlyph /><div><h2>Mission tutor</h2><small>Local sample mode</small></div></div>
          <button className="tutor-suggestion" onClick={() => askTutor('Explain it more simply')}><CircleHelp size={20} /> Explain it more simply <ChevronRight size={19} /></button>
          <button className="tutor-suggestion" onClick={() => askTutor('Show another example')}><Sparkles size={20} /> Show another example <ChevronRight size={19} /></button>
          {step === 3 && <button className="tutor-suggestion" onClick={() => askTutor('I am stuck. Give me a hint.')}><MessageSquare size={20} /> Give me a hint <ChevronRight size={19} /></button>}
          {tutorText && (
            <div className="inline-tutor-response" aria-live="polite">
              <strong>Sample mission tutor</strong>
              <p>{tutorText}</p>
              <small>{tutorSource}</small>
            </div>
          )}
          <form className="tutor-input-card" onSubmit={submitTutor}>
            <label htmlFor="mission-tutor-input"><MessageSquare size={18} /> Ask about this lesson</label>
            <div className="input-with-action">
              <input id="mission-tutor-input" name="mission-tutor-input" placeholder="Ask about this lesson" />
              <button type="submit" aria-label="Send to mission tutor"><Send size={20} /></button>
            </div>
          </form>
          <small className="grounding-note"><LockKeyhole size={15} /> Fallback responses use only this mission’s committed content.</small>
        </aside>
      </div>
    </main>
  )
}
