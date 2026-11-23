import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

describe('Signal & Spark app', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })
    vi.stubGlobal('scrollTo', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('opens the journey with the expected mission map', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Your AI learning journey' })).toBeTruthy()
    expect(screen.getAllByText('Prompt Engineering').length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/8\. Retrieval, locked/).hasAttribute('disabled')).toBe(true)
  })

  it('starts the current mission with its lesson', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Continue: Prompt Engineering/ }))
    expect(screen.getByRole('heading', { name: 'Prompt Engineering' })).toBeTruthy()
    expect(screen.getByText('Give the model a useful brief')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Try an example/ })).toBeTruthy()
  })

  it('opens the content manager and exposes the publishing gate', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Content manager/ }))
    expect(screen.getByRole('heading', { name: 'Edit mission' })).toBeTruthy()
    expect(screen.getByText('Ready to publish')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Publish$/ })).toBeTruthy()
  })

  it('labels the tutor as a local sample fallback', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'AI Tutor' }))
    expect(screen.getByRole('heading', { name: 'AI Only Mode' })).toBeTruthy()
    expect(screen.getByText('Local sample tutor')).toBeTruthy()
    expect(screen.getByText(/send no data to an external service/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Explain it more simply' }))
    expect(screen.getByText('Sample mission tutor')).toBeTruthy()
  })

  it('shows a level consistent with the seeded progress', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Progress' }))
    expect(screen.getByText('Current level · Beginner')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '3 missions complete' })).toBeTruthy()
    expect(screen.getByText(/earned 3 milestones across 8 curated missions/)).toBeTruthy()
  })

  it('keeps an incomplete new mission in draft status', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Content manager/ }))
    fireEvent.click(screen.getByRole('button', { name: 'New mission' }))
    fireEvent.click(screen.getByRole('button', { name: /^Publish$/ }))
    expect(screen.getByText('Content incomplete')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/Add at least 5 questions, 3 flashcards/)
    expect(screen.getByRole('button', { name: /Untitled mission Draft/ })).toBeTruthy()
  })
})
