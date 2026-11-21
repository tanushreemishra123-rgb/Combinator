import type { Flashcard, LearningProgress, Mission, QuizQuestion } from '../types'

export interface TutorReply {
  text: string
  source: string
}

export type LearnerLevel = 'New to AI' | 'Some experience'

const stopWords = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'can', 'could', 'does', 'for', 'from',
  'have', 'how', 'into', 'more', 'that', 'the', 'this', 'what', 'when', 'where', 'which',
  'with', 'would', 'you', 'your',
])

const tokens = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token))

const cardScore = (queryTokens: string[], card: Flashcard): number => {
  const body = new Set(tokens(`${card.term} ${card.definition} ${card.example} ${card.commonMistake}`))
  return queryTokens.reduce((score, token) => score + (body.has(token) ? 1 : 0), 0)
}

const bestCard = (mission: Mission, query: string): Flashcard => {
  const queryTokens = tokens(query)
  return [...mission.flashcards].sort((a, b) => cardScore(queryTokens, b) - cardScore(queryTokens, a))[0]
}

const nextRecommendation = (missions: Mission[], progress: LearningProgress, currentMissionId: string): Mission | undefined =>
  missions
    .filter((mission) => mission.enabled && mission.status === 'Published')
    .find((mission) => mission.id !== currentMissionId && !progress.completedMissionIds.includes(mission.id))

export const createTutorReply = ({
  mission,
  input,
  level,
  currentQuestion,
  missions,
  progress,
}: {
  mission: Mission
  input: string
  level: LearnerLevel
  currentQuestion?: QuizQuestion
  missions: Mission[]
  progress: LearningProgress
}): TutorReply => {
  const normalized = input.trim().toLowerCase()

  if (!normalized) {
    return {
      text: 'Ask about the lesson, request a simpler explanation, or ask for a hint. I will answer from the current mission content.',
      source: `Mission: ${mission.title}`,
    }
  }

  if (/hint|stuck|help.*question/.test(normalized) && currentQuestion) {
    return {
      text: `Here is a hint without giving away the answer: ${currentQuestion.hint}`,
      source: `Checkpoint: ${currentQuestion.reviewTopic}`,
    }
  }

  if (/why.*(correct|wrong)|explain.*answer/.test(normalized) && currentQuestion) {
    return {
      text: currentQuestion.explanation,
      source: `Checkpoint explanation: ${currentQuestion.reviewTopic}`,
    }
  }

  if (/next|learn after|recommend/.test(normalized)) {
    const next = nextRecommendation(missions, progress, mission.id)
    return next
      ? {
          text: `I recommend “${next.title}” next. Its goal is to ${next.objective.charAt(0).toLowerCase()}${next.objective.slice(1)}`,
          source: 'Recommendation based on your completed missions',
        }
      : {
          text: 'You have completed every currently published mission. Review the mission with your lowest quiz score or practice its flashcards.',
          source: 'Recommendation based on your completed missions',
        }
  }

  if (/example|scenario|show me/.test(normalized)) {
    return {
      text: `Here is the mission example: ${mission.example}`,
      source: `Example: ${mission.title}`,
    }
  }

  if (/simple|beginner|plain|easier/.test(normalized)) {
    const card = mission.flashcards[0]
    return {
      text: `${card.term} means ${card.definition.charAt(0).toLowerCase()}${card.definition.slice(1)} A simple example is: ${card.example}`,
      source: `Flashcard: ${card.term}`,
    }
  }

  if (/summar|lesson|overview/.test(normalized)) {
    return {
      text: `${mission.lessonTitle}. ${mission.lesson} The main goal is to ${mission.objective.charAt(0).toLowerCase()}${mission.objective.slice(1)}`,
      source: `Lesson: ${mission.title}`,
    }
  }

  const card = bestCard(mission, input)
  const experienced = level === 'Some experience'
  return {
    text: experienced
      ? `${card.definition} In practice: ${card.example} A useful failure mode to watch for is ${card.commonMistake.charAt(0).toLowerCase()}${card.commonMistake.slice(1)}`
      : `${card.term} means ${card.definition.charAt(0).toLowerCase()}${card.definition.slice(1)} For example: ${card.example}`,
    source: `Flashcard: ${card.term}`,
  }
}
