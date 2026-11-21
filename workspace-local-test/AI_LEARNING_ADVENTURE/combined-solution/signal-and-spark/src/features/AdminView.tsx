import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileQuestion,
  Layers3,
  Plus,
  Save,
  Search,
} from 'lucide-react'
import { BrandMark } from '../components/Brand'
import { Button, StatusLabel } from '../components/Ui'
import type { ContentStatus, Flashcard, Mission, QuizQuestion } from '../types'

type ContentMode = 'missions' | 'questions' | 'flashcards'

const statusTone = (status: ContentStatus) => status === 'Published' ? 'teal' : status === 'Draft' ? 'coral' : 'neutral'

const blankQuestion = (): QuizQuestion => ({
  id: `question-${crypto.randomUUID()}`,
  prompt: 'Add a clear checkpoint question.',
  options: ['First option', 'Second option', 'Third option'],
  correctIndex: 0,
  explanation: 'Explain why the correct answer works.',
  hint: 'Offer a useful hint without giving away the answer.',
  reviewTopic: 'New topic',
})

const blankFlashcard = (): Flashcard => ({
  id: `flashcard-${crypto.randomUUID()}`,
  term: 'New concept',
  definition: 'Add a concise, accurate definition.',
  example: 'Add one practical example.',
  commonMistake: 'Add one common mistake to avoid.',
})

export function AdminView({
  missions,
  updateMission,
  addMission,
  onBack,
  onPreview,
}: {
  missions: Mission[]
  updateMission: (mission: Mission) => void
  addMission: () => string
  onBack: () => void
  onPreview: (mission: Mission) => void
}) {
  const [mode, setMode] = useState<ContentMode>('missions')
  const [selectedId, setSelectedId] = useState(missions.find((mission) => mission.id === 'prompt-engineering')?.id ?? missions[0]?.id)
  const [working, setWorking] = useState<Mission | null>(() => structuredClone(missions.find((mission) => mission.id === selectedId) ?? missions[0]))
  const [search, setSearch] = useState('')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [flashcardIndex, setFlashcardIndex] = useState(0)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const selected = missions.find((mission) => mission.id === selectedId)
    if (selected) setWorking(structuredClone(selected))
  }, [missions, selectedId])

  const filtered = useMemo(() => missions.filter((mission) => mission.title.toLowerCase().includes(search.toLowerCase())), [missions, search])
  const ready = Boolean(
    working &&
    working.title.trim() &&
    working.objective.trim() &&
    working.lesson.trim() &&
    working.questions.length >= 5 &&
    working.flashcards.length >= 3 &&
    working.checkpoint.trim() &&
    working.badge.trim(),
  )

  const selectMission = (id: string) => {
    setSelectedId(id)
    setQuestionIndex(0)
    setFlashcardIndex(0)
    setNotice('')
  }

  const save = (status: ContentStatus) => {
    if (!working) return
    const next = { ...working, status, enabled: status === 'Disabled' ? false : working.enabled }
    updateMission(next)
    setWorking(next)
    setNotice(status === 'Published' ? 'Published after manual review.' : status === 'Draft' ? 'Draft saved locally.' : 'Mission disabled.')
  }

  const publish = () => {
    if (!ready) {
      setNotice('Add at least 5 questions, 3 flashcards, a checkpoint, a badge, and complete the required text before publishing.')
      return
    }
    save('Published')
  }

  const createMission = () => {
    const id = addMission()
    setSelectedId(id)
    setMode('missions')
    setNotice('New draft created.')
  }

  if (!working) return null
  const question = working.questions.at(questionIndex)
  const flashcard = working.flashcards.at(flashcardIndex)

  const updateQuestion = (patch: Partial<QuizQuestion>) => {
    setWorking((current) => current ? { ...current, questions: current.questions.map((item, index) => index === questionIndex ? { ...item, ...patch } : item), status: 'Draft' } : current)
  }

  const updateFlashcard = (patch: Partial<Flashcard>) => {
    setWorking((current) => current ? { ...current, flashcards: current.flashcards.map((item, index) => index === flashcardIndex ? { ...item, ...patch } : item), status: 'Draft' } : current)
  }

  const addQuestion = () => {
    setWorking((current) => current ? { ...current, questions: [...current.questions, blankQuestion()], status: 'Draft' } : current)
    setQuestionIndex(working.questions.length)
  }

  const addFlashcard = () => {
    setWorking((current) => current ? { ...current, flashcards: [...current.flashcards, blankFlashcard()], status: 'Draft' } : current)
    setFlashcardIndex(working.flashcards.length)
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <BrandMark />
        <span className="header-divider" />
        <strong>Content manager</strong>
        <div className="admin-header-actions">
          <Button variant="secondary" onClick={() => { updateMission(working); onPreview(working) }}><Eye size={18} /> Preview as learner</Button>
          <Button variant="secondary" onClick={onBack}><ArrowLeft size={18} /> Back to journey</Button>
        </div>
      </header>
      <div className="admin-workspace">
        <nav className="content-nav" aria-label="Content types">
          <h2>Content</h2>
          <button className={mode === 'missions' ? 'active' : ''} onClick={() => setMode('missions')}><BookOpen size={21} /> Missions</button>
          <button className={mode === 'questions' ? 'active' : ''} onClick={() => setMode('questions')}><FileQuestion size={21} /> Quiz questions</button>
          <button className={mode === 'flashcards' ? 'active' : ''} onClick={() => setMode('flashcards')}><Layers3 size={21} /> Flashcards</button>
        </nav>

        <aside className="mission-list-panel">
          <div className="panel-title-row"><h2>Missions</h2><Button onClick={createMission}><Plus size={18} /> New mission</Button></div>
          <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search missions" /></label>
          <div className="admin-mission-list">{filtered.map((mission) => <button key={mission.id} className={working.id === mission.id ? 'selected' : ''} onClick={() => selectMission(mission.id)}><span><strong>{mission.title}</strong><StatusLabel tone={statusTone(mission.status)}>{mission.status}</StatusLabel></span><ChevronRight size={20} /></button>)}</div>
        </aside>

        <section className="editor-panel">
          <div className="editor-heading">
            <div><h1>{mode === 'missions' ? 'Edit mission' : mode === 'questions' ? 'Edit quiz questions' : 'Edit flashcards'}</h1><p>{working.title}</p></div>
            <label className="toggle-label">Enabled<input type="checkbox" checked={working.enabled} onChange={(event) => setWorking({ ...working, enabled: event.target.checked, status: event.target.checked ? 'Draft' : 'Disabled' })} /><span /></label>
          </div>

          {mode === 'missions' && (
            <div className="editor-form mission-editor-form">
              <div className="field-grid two"><label>Title<input value={working.title} onChange={(event) => setWorking({ ...working, title: event.target.value, status: 'Draft' })} /></label><label>Difficulty<select value={working.difficulty} onChange={(event) => setWorking({ ...working, difficulty: event.target.value as Mission['difficulty'], status: 'Draft' })}><option>Beginner</option><option>Basic Understanding</option><option>Applied Practice</option><option>Responsible Use</option><option>Builder Mindset</option></select></label></div>
              <label>Learning objective<textarea rows={2} value={working.objective} onChange={(event) => setWorking({ ...working, objective: event.target.value, status: 'Draft' })} /></label>
              <label>Lesson content<textarea rows={4} value={working.lesson} onChange={(event) => setWorking({ ...working, lesson: event.target.value, status: 'Draft' })} /></label>
              <label>Example or scenario<textarea rows={3} value={working.example} onChange={(event) => setWorking({ ...working, example: event.target.value, status: 'Draft' })} /></label>
              <div className="field-grid two"><label>Checkpoint<textarea rows={2} value={working.checkpoint} onChange={(event) => setWorking({ ...working, checkpoint: event.target.value, status: 'Draft' })} /></label><label>Badge or milestone<input value={working.badge} onChange={(event) => setWorking({ ...working, badge: event.target.value, status: 'Draft' })} /></label></div>
            </div>
          )}

          {mode === 'questions' && (
            <div className="item-editor-layout">
              <aside className="item-index"><div><strong>{working.questions.length} questions</strong><Button variant="secondary" onClick={addQuestion}><Plus size={16} /> Add</Button></div>{working.questions.map((item, index) => <button key={item.id} className={index === questionIndex ? 'active' : ''} onClick={() => setQuestionIndex(index)}><span>{index + 1}</span>{item.prompt}<ChevronRight size={16} /></button>)}</aside>
              {question ? <div className="editor-form"><label>Question<textarea rows={3} value={question.prompt} onChange={(event) => updateQuestion({ prompt: event.target.value })} /></label><label>Answer options<textarea rows={4} value={question.options.join('\n')} onChange={(event) => updateQuestion({ options: event.target.value.split('\n').filter(Boolean) })} /><small>One option per line</small></label><label>Correct answer<select value={question.correctIndex} onChange={(event) => updateQuestion({ correctIndex: Number(event.target.value) })}>{question.options.map((option, index) => <option value={index} key={`${index}-${option}`}>{index + 1}. {option}</option>)}</select></label><label>Answer explanation<textarea rows={3} value={question.explanation} onChange={(event) => updateQuestion({ explanation: event.target.value })} /></label><div className="field-grid two"><label>Hint<input value={question.hint} onChange={(event) => updateQuestion({ hint: event.target.value })} /></label><label>Review topic<input value={question.reviewTopic} onChange={(event) => updateQuestion({ reviewTopic: event.target.value })} /></label></div></div> : <div className="empty-editor">Add a question to this mission.</div>}
            </div>
          )}

          {mode === 'flashcards' && (
            <div className="item-editor-layout">
              <aside className="item-index"><div><strong>{working.flashcards.length} flashcards</strong><Button variant="secondary" onClick={addFlashcard}><Plus size={16} /> Add</Button></div>{working.flashcards.map((item, index) => <button key={item.id} className={index === flashcardIndex ? 'active' : ''} onClick={() => setFlashcardIndex(index)}><span>{index + 1}</span>{item.term}<ChevronRight size={16} /></button>)}</aside>
              {flashcard ? <div className="editor-form"><label>Concept<input value={flashcard.term} onChange={(event) => updateFlashcard({ term: event.target.value })} /></label><label>Simple definition<textarea rows={3} value={flashcard.definition} onChange={(event) => updateFlashcard({ definition: event.target.value })} /></label><label>Example<textarea rows={3} value={flashcard.example} onChange={(event) => updateFlashcard({ example: event.target.value })} /></label><label>Common mistake or learning tip<textarea rows={3} value={flashcard.commonMistake} onChange={(event) => updateFlashcard({ commonMistake: event.target.value })} /></label></div> : <div className="empty-editor">Add a flashcard to this mission.</div>}
            </div>
          )}

          <div className={`publish-readiness ${ready ? 'ready' : 'incomplete'}`}>
            {ready ? <CheckCircle2 size={28} /> : <FileQuestion size={28} />}
            <span><strong>{ready ? 'Ready to publish' : 'Content incomplete'}</strong><small>{working.questions.length} quiz questions · {working.flashcards.length} flashcards · {working.checkpoint ? 1 : 0} checkpoint · {working.badge ? 1 : 0} badge</small></span>
            <p>Review learner-facing content before publishing.</p>
          </div>
          {notice && <p className="editor-notice" role="status">{notice}</p>}
          <div className="editor-actions"><Button variant="secondary" onClick={() => onPreview(working)}><Eye size={18} /> Preview</Button><Button variant="secondary" onClick={() => save(working.enabled ? 'Draft' : 'Disabled')}><Save size={18} /> Save draft</Button><Button onClick={publish}><Check size={18} /> Publish</Button></div>
        </section>
      </div>
    </main>
  )
}
