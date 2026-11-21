import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Header } from './components/Header'
import { AdminView } from './features/AdminView'
import { JourneyView } from './features/JourneyView'
import { MissionView } from './features/MissionView'
import { PracticeView } from './features/PracticeView'
import { ProgressView } from './features/ProgressView'
import { TutorView } from './features/TutorView'
import { useLearningStore } from './lib/storage'
import type { LearnerView, Mission } from './types'

export function App() {
  const store = useLearningStore()
  const [view, setView] = useState<LearnerView>('journey')
  const [selectedMissionId, setSelectedMissionId] = useState(store.progress.lastMissionId)
  const [previewMission, setPreviewMission] = useState<Mission | null>(null)
  const [tutorMissionId, setTutorMissionId] = useState(store.progress.lastMissionId)
  const [tutorPrompt, setTutorPrompt] = useState('')
  const [tutorRequestId, setTutorRequestId] = useState(0)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [view, selectedMissionId])

  const selectedMission = previewMission?.id === selectedMissionId
    ? previewMission
    : store.missions.find((mission) => mission.id === selectedMissionId) ?? store.missions[0]

  const navigate = (next: LearnerView) => {
    setPreviewMission(null)
    setTutorPrompt('')
    setView(next)
  }

  const openMission = (id: string) => {
    setPreviewMission(null)
    setSelectedMissionId(id)
    setView('mission')
  }

  const continueLearning = () => openMission(store.progress.lastMissionId)

  const openTutor = (missionId: string, prompt = '') => {
    setTutorMissionId(missionId)
    setTutorPrompt(prompt)
    setTutorRequestId((id) => id + 1)
    setView('tutor')
  }

  const completeMission = (mission: Mission, correct: number) => {
    store.completeMission(mission, correct)
    setPreviewMission(null)
    setView('progress')
  }

  const preview = (mission: Mission) => {
    setPreviewMission(structuredClone(mission))
    setSelectedMissionId(mission.id)
    setView('mission')
  }

  const resetDemo = () => {
    if (!window.confirm('Reset this browser’s Signal & Spark content and progress to the original demo?')) return
    store.resetDemo()
    setPreviewMission(null)
    setSelectedMissionId('prompt-engineering')
    setView('journey')
  }

  if (view === 'admin') {
    return (
      <AdminView
        missions={store.missions}
        updateMission={store.updateMission}
        addMission={store.addMission}
        onBack={() => navigate('journey')}
        onPreview={preview}
      />
    )
  }

  return (
    <div className="app">
      <Header active={view} onNavigate={navigate} onContinue={continueLearning} />
      {view === 'journey' && <JourneyView missions={store.missions} progress={store.progress} onOpenMission={openMission} onOpenTutor={openTutor} />}
      {view === 'mission' && selectedMission && <MissionView key={`${selectedMission.id}-${previewMission ? 'preview' : 'live'}`} mission={selectedMission} missions={store.missions} progress={store.progress} onBack={() => navigate(previewMission ? 'admin' : 'journey')} onComplete={completeMission} />}
      {view === 'practice' && <PracticeView missions={store.missions} />}
      {view === 'tutor' && <TutorView key={tutorRequestId} missions={store.missions} progress={store.progress} initialMissionId={tutorMissionId} initialPrompt={tutorPrompt} />}
      {view === 'progress' && <ProgressView missions={store.missions} progress={store.progress} onOpenMission={openMission} onReset={resetDemo} />}
      <footer className="app-footer">
        <span>Signal &amp; Spark · Local learning demo</span>
        <button onClick={() => setView('admin')}><Settings2 size={17} /> Content manager</button>
      </footer>
    </div>
  )
}
