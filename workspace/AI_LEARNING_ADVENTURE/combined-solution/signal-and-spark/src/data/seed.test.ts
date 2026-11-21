import { describe, expect, it } from 'vitest'
import { seedMissions } from './seed'

describe('curated seed content', () => {
  it('meets the challenge content floor', () => {
    expect(seedMissions).toHaveLength(8)
    expect(new Set(seedMissions.map((mission) => mission.id)).size).toBe(seedMissions.length)
    expect(new Set(seedMissions.map((mission) => mission.order)).size).toBe(seedMissions.length)

    for (const mission of seedMissions) {
      expect(mission.questions.length).toBeGreaterThanOrEqual(5)
      expect(mission.flashcards.length).toBeGreaterThanOrEqual(3)
      expect(mission.checkpoint.trim()).not.toBe('')
      expect(mission.badge.trim()).not.toBe('')
      expect(mission.objective.trim()).not.toBe('')
    }
  })

  it('contains the preferred amount of practice content', () => {
    const questionCount = seedMissions.reduce((total, mission) => total + mission.questions.length, 0)
    const flashcardCount = seedMissions.reduce((total, mission) => total + mission.flashcards.length, 0)
    expect(questionCount).toBeGreaterThanOrEqual(50)
    expect(flashcardCount).toBeGreaterThanOrEqual(30)
  })

  it('uses valid answer indices and unique item identifiers', () => {
    const ids = seedMissions.flatMap((mission) => [
      ...mission.questions.map((question) => question.id),
      ...mission.flashcards.map((card) => card.id),
    ])
    expect(new Set(ids).size).toBe(ids.length)
    for (const mission of seedMissions) {
      for (const question of mission.questions) {
        expect(question.options.length).toBeGreaterThanOrEqual(3)
        expect(question.correctIndex).toBeGreaterThanOrEqual(0)
        expect(question.correctIndex).toBeLessThan(question.options.length)
        expect(question.explanation.trim()).not.toBe('')
        expect(question.hint.trim()).not.toBe('')
      }
    }
  })
})
