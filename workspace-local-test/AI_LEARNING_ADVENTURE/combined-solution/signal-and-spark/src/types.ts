export type Difficulty = 'Beginner' | 'Basic Understanding' | 'Applied Practice' | 'Responsible Use' | 'Builder Mindset'

export type ContentStatus = 'Published' | 'Draft' | 'Disabled'

export interface QuizQuestion {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
  hint: string
  reviewTopic: string
}

export interface Flashcard {
  id: string
  term: string
  definition: string
  example: string
  commonMistake: string
}

export interface Mission {
  id: string
  order: number
  title: string
  difficulty: Difficulty
  duration: number
  objective: string
  lessonTitle: string
  lesson: string
  example: string
  checkpoint: string
  badge: string
  status: ContentStatus
  enabled: boolean
  questions: QuizQuestion[]
  flashcards: Flashcard[]
}

export interface MissionResult {
  missionId: string
  correct: number
  total: number
  completedAt: string
}

export interface LearningProgress {
  completedMissionIds: string[]
  results: Record<string, MissionResult>
  earnedBadges: string[]
  lastMissionId: string
}

export type LearnerView = 'journey' | 'mission' | 'practice' | 'tutor' | 'progress' | 'admin'

export interface TutorMessage {
  id: string
  role: 'learner' | 'tutor'
  text: string
  source?: string
}
