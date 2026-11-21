import { useEffect, useState } from 'react'
import { freshSeedMissions } from '../data/seed'
import type { LearningProgress, Mission } from '../types'

const CONTENT_KEY = 'signal-spark-content-v1'
const PROGRESS_KEY = 'signal-spark-progress-v1'

export const initialProgress: LearningProgress = {
  completedMissionIds: ['ai-capabilities', 'generative-ai', 'llm-basics'],
  results: {
    'ai-capabilities': {
      missionId: 'ai-capabilities',
      correct: 6,
      total: 7,
      completedAt: '2026-08-11T10:00:00.000Z',
    },
    'generative-ai': {
      missionId: 'generative-ai',
      correct: 7,
      total: 7,
      completedAt: '2026-08-12T10:00:00.000Z',
    },
    'llm-basics': {
      missionId: 'llm-basics',
      correct: 6,
      total: 7,
      completedAt: '2026-08-13T10:00:00.000Z',
    },
  },
  earnedBadges: ['AI Spotter', 'Pattern Maker', 'Token Tracker'],
  lastMissionId: 'prompt-engineering',
}

const safeParse = <T,>(value: string | null, fallback: T, validate: (candidate: unknown) => boolean): T => {
  if (!value) return fallback
  try {
    const candidate: unknown = JSON.parse(value)
    return validate(candidate) ? (candidate as T) : fallback
  } catch {
    return fallback
  }
}

const validMissions = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length >= 5 &&
  value.every((item) =>
    Boolean(
      item &&
        typeof item === 'object' &&
        typeof (item as Mission).id === 'string' &&
        Array.isArray((item as Mission).questions) &&
        Array.isArray((item as Mission).flashcards),
    ),
  )

const validProgress = (value: unknown): boolean =>
  Boolean(
    value &&
      typeof value === 'object' &&
      Array.isArray((value as LearningProgress).completedMissionIds) &&
      Array.isArray((value as LearningProgress).earnedBadges) &&
      typeof (value as LearningProgress).results === 'object',
  )

export const loadMissions = (): Mission[] => {
  if (typeof window === 'undefined') return freshSeedMissions()
  return safeParse(window.localStorage.getItem(CONTENT_KEY), freshSeedMissions(), validMissions)
}

export const loadProgress = (): LearningProgress => {
  if (typeof window === 'undefined') return structuredClone(initialProgress)
  return safeParse(
    window.localStorage.getItem(PROGRESS_KEY),
    structuredClone(initialProgress),
    validProgress,
  )
}

export const useLearningStore = () => {
  const [missions, setMissions] = useState<Mission[]>(loadMissions)
  const [progress, setProgress] = useState<LearningProgress>(loadProgress)

  useEffect(() => {
    window.localStorage.setItem(CONTENT_KEY, JSON.stringify(missions))
  }, [missions])

  useEffect(() => {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  }, [progress])

  const updateMission = (mission: Mission) => {
    setMissions((current) =>
      current
        .map((item) => (item.id === mission.id ? structuredClone(mission) : item))
        .sort((a, b) => a.order - b.order),
    )
  }

  const addMission = () => {
    const id = `mission-${crypto.randomUUID()}`
    const next: Mission = {
      id,
      order: missions.length + 1,
      title: 'Untitled mission',
      difficulty: 'Beginner',
      duration: 10,
      objective: 'Describe what a learner will be able to do.',
      lessonTitle: 'New lesson',
      lesson: 'Add clear, reviewed learner-facing content here.',
      example: 'Add a concrete example or scenario.',
      checkpoint: 'Add a short checkpoint activity.',
      badge: 'New milestone',
      status: 'Draft',
      enabled: true,
      questions: [],
      flashcards: [],
    }
    setMissions((current) => [...current, next])
    return id
  }

  const completeMission = (mission: Mission, correct: number) => {
    setProgress((current) => {
      const completedMissionIds = current.completedMissionIds.includes(mission.id)
        ? current.completedMissionIds
        : [...current.completedMissionIds, mission.id]
      const earnedBadges = current.earnedBadges.includes(mission.badge)
        ? current.earnedBadges
        : [...current.earnedBadges, mission.badge]
      const nextMission = missions.find((item) => item.order === mission.order + 1 && item.enabled)
      return {
        completedMissionIds,
        earnedBadges,
        lastMissionId: nextMission?.id ?? mission.id,
        results: {
          ...current.results,
          [mission.id]: {
            missionId: mission.id,
            correct,
            total: mission.questions.length,
            completedAt: new Date().toISOString(),
          },
        },
      }
    })
  }

  const resetDemo = () => {
    const nextMissions = freshSeedMissions()
    const nextProgress = structuredClone(initialProgress)
    setMissions(nextMissions)
    setProgress(nextProgress)
    window.localStorage.removeItem(CONTENT_KEY)
    window.localStorage.removeItem(PROGRESS_KEY)
  }

  return {
    missions,
    setMissions,
    progress,
    setProgress,
    updateMission,
    addMission,
    completeMission,
    resetDemo,
  }
}
