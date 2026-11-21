/** The gallery: eight broken workflows, grouped by difficulty. */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Puzzle, TriangleAlert } from 'lucide-react'
import { api } from '@/api/client'
import type { Difficulty, PuzzleSummary } from '@/api/types'
import AppHeader from '@/components/AppHeader'
import DifficultyBadge from '@/components/DifficultyBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const SECTIONS: { difficulty: Difficulty; title: string; blurb: string }[] = [
  { difficulty: 'beginner', title: 'Beginner', blurb: 'One thing goes wrong. Learn to see it.' },
  {
    difficulty: 'intermediate',
    title: 'Intermediate',
    blurb: 'Failures that need a guard, not just a fix.',
  },
  {
    difficulty: 'advanced',
    title: 'Advanced',
    blurb: 'Recover, fall back, and pick up where you left off.',
  },
]

function PuzzleCard({ puzzle }: { puzzle: PuzzleSummary }) {
  return (
    <Link
      to={`/puzzle/${puzzle.id}`}
      className="group animate-drift flex flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-panel hover:ring-primary/35 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs tracking-widest text-muted-foreground/70 tabular-nums">
          {String(puzzle.order).padStart(2, '0')}
        </span>
        <DifficultyBadge difficulty={puzzle.difficulty} />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-semibold">{puzzle.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{puzzle.tagline}</p>
      </div>

      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        {puzzle.concepts.map((concept) => (
          <Badge key={concept} variant="secondary" className="font-normal">
            {concept}
          </Badge>
        ))}
      </div>

      <span className="flex items-center gap-1 pt-1 text-sm font-medium text-primary">
        Open the builder
        <ArrowRight
          aria-hidden="true"
          className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  )
}

export default function PuzzleSelect() {
  const [puzzles, setPuzzles] = useState<PuzzleSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .listPuzzles()
      .then((result) => {
        if (!cancelled) setPuzzles([...result].sort((a, b) => a.order - b.order))
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load the puzzles.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader>
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Puzzle aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">AI Workflow Puzzle Builder</h1>
          <p className="truncate text-xs text-muted-foreground">
            Build workflows that survive the real world
          </p>
        </div>
      </AppHeader>

      <main className="mx-auto w-full max-w-6xl grow px-6 py-12">
        <section className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">Pick your puzzle</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Each puzzle hands you a workflow that breaks. Drag in the right blocks, guard the
            fragile steps, and make it come back from failure.
          </p>
        </section>

        {error && (
          <Alert variant="destructive" className="mb-8">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Could not reach the puzzle server</AlertTitle>
            <AlertDescription>
              <p>{error}</p>
              <p>
                Start the backend, or run the frontend with <code>VITE_MOCK_API=1</code> for the
                fixtures.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {!puzzles && !error && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-52 rounded-2xl" />
            ))}
          </div>
        )}

        {puzzles &&
          SECTIONS.map(({ difficulty, title, blurb }) => {
            const inSection = puzzles.filter((puzzle) => puzzle.difficulty === difficulty)
            if (inSection.length === 0) return null
            return (
              <section key={difficulty} className="mb-12">
                <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-sm font-semibold tracking-wide uppercase">{title}</h3>
                  <p className="text-sm text-muted-foreground">{blurb}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {inSection.map((puzzle) => (
                    <PuzzleCard key={puzzle.id} puzzle={puzzle} />
                  ))}
                </div>
              </section>
            )
          })}
      </main>
    </div>
  )
}
