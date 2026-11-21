import { describe, expect, it } from 'vitest'
import { seedMissions } from '../data/seed'
import { initialProgress } from './storage'
import { createTutorReply } from './tutor'

const mission = seedMissions.find((item) => item.id === 'prompt-engineering')!

describe('local mission tutor', () => {
  it('returns a simple explanation with a visible mission source', () => {
    const reply = createTutorReply({
      mission,
      input: 'Explain it more simply',
      level: 'New to AI',
      missions: seedMissions,
      progress: initialProgress,
    })
    expect(reply.text).toContain(mission.flashcards[0].term)
    expect(reply.source).toContain('Flashcard')
  })

  it('gives the curated hint without revealing the option', () => {
    const question = mission.questions[0]
    const reply = createTutorReply({
      mission,
      input: 'I am stuck, give me a hint',
      level: 'New to AI',
      currentQuestion: question,
      missions: seedMissions,
      progress: initialProgress,
    })
    expect(reply.text).toContain(question.hint)
    expect(reply.text).not.toContain(question.options.at(question.correctIndex)!)
  })

  it('recommends an enabled published mission', () => {
    const reply = createTutorReply({
      mission,
      input: 'What should I learn next?',
      level: 'Some experience',
      missions: seedMissions,
      progress: initialProgress,
    })
    expect(reply.text).toContain('Tokens & Context')
    expect(reply.source).toContain('completed missions')
  })
})
