/** Right rail when nothing is selected: what this puzzle is asking for. */

import { Bomb, Flag, FileJson, Layers, ListChecks, Target } from 'lucide-react'
import type { PuzzleDetail } from '@/api/types'
import { CATALOG } from '@/blocks/catalog'
import SectionHeading from '@/components/SectionHeading'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export default function PuzzleBrief({ puzzle }: { puzzle: PuzzleDetail }) {
  return (
    <div className="space-y-5 p-4 text-sm">
      <section className="space-y-2">
        <SectionHeading Icon={Target} tone="text-primary">
          Your mission
        </SectionHeading>
        <p className="leading-relaxed font-medium">{puzzle.objective}</p>
        <p className="leading-relaxed text-muted-foreground">{puzzle.description}</p>
      </section>

      <Separator />

      <section className="space-y-2">
        <SectionHeading Icon={FileJson}>Sample input</SectionHeading>
        <pre className="max-h-52 overflow-auto rounded-xl bg-muted p-3 text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
          {JSON.stringify(puzzle.sample_input, null, 2)}
        </pre>
      </section>

      <section className="space-y-2">
        <SectionHeading Icon={Flag} tone="text-success">
          What success looks like
        </SectionHeading>
        <p className="leading-relaxed text-muted-foreground">{puzzle.expected_output}</p>
      </section>

      <section className="space-y-2">
        <SectionHeading Icon={ListChecks} tone="text-success">
          Completion criteria
        </SectionHeading>
        <ul className="space-y-1.5">
          {puzzle.completion_criteria.map((criterion) => (
            <li
              key={criterion}
              className="flex gap-2 leading-relaxed text-muted-foreground before:mt-2 before:size-1 before:shrink-0 before:rounded-full before:bg-muted-foreground/50 before:content-['']"
            >
              {criterion}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <SectionHeading Icon={Layers}>Blocks you can use</SectionHeading>
        <div className="flex flex-wrap gap-1.5">
          {puzzle.available_blocks.map((type) => {
            const meta = CATALOG[type] // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: type is the BlockType union, not user input
            return (
              <Badge
                key={type}
                variant="outline"
                data-category={meta.category}
                className="cat-tint gap-1 border-(--tint)/25 bg-(--tint)/8 font-normal text-(--tint)"
              >
                <meta.Icon aria-hidden="true" />
                {meta.displayName}
              </Badge>
            )
          })}
        </div>
      </section>

      {puzzle.failure_scenarios.length > 0 && (
        <section className="space-y-2">
          <SectionHeading Icon={Bomb} tone="text-status-failed">
            What can go wrong
          </SectionHeading>
          <ul className="space-y-2">
            {puzzle.failure_scenarios.map((scenario) => (
              <li key={scenario.id} className="leading-relaxed text-muted-foreground">
                <strong className="font-semibold text-foreground">{scenario.label}</strong> -{' '}
                {scenario.description}
              </li>
            ))}
          </ul>
        </section>
      )}

      {puzzle.solution_hint && (
        <details className="group rounded-xl border border-border bg-card p-3">
          <summary className="cursor-pointer text-xs font-semibold text-primary select-none">
            Need a nudge?
          </summary>
          <p className="mt-2 leading-relaxed text-muted-foreground">{puzzle.solution_hint}</p>
        </details>
      )}

      <p className="pt-1 text-xs text-muted-foreground/80">
        Select a block on the canvas to configure it.
      </p>
    </div>
  )
}
