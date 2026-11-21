/**
 * The pay-off screen: how well the workflow held up, in plain language.
 *
 * Grade + score dial, the puzzle's completion checklist, what went right and
 * what is still fragile, and the three things worth doing next - run again,
 * arm a failure scenario, or resume a failed run from its last good step.
 */

import type { CSSProperties } from 'react'
import {
  Check,
  FlaskConical,
  History,
  ListChecks,
  Loader,
  OctagonAlert,
  Play,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react'
import type { ReliabilityReport, RunStatus } from '@/api/types'
import { GRADE_META } from '@/components/grades'
import SectionHeading from '@/components/SectionHeading'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Props {
  report: ReliabilityReport
  status: RunStatus | null
  /** Available when the run failed - clones the run from the last good step. */
  canResume: boolean
  scenarioArmed: boolean
  hasScenarios: boolean
  busy: boolean
  onClose: () => void
  onRunAgain: () => void
  onBreakIt: () => void
  onResumeLast: () => void
}

const DIAL_RADIUS = 46
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS

/** Deterministic confetti burst - no library, no randomness between renders. */
const CONFETTI = Array.from({ length: 18 }, (_, index) => ({
  left: `${(index * 5.5 + (index % 3) * 4) % 100}%`,
  delay: `${(index % 6) * 90}ms`,
  tone:
    // nosemgrep: gitlab.eslint.detect-object-injection -- array index from the generator's own counter, modulo the literal array's length
    ['bg-primary', 'bg-success', 'bg-warning', 'bg-cat-core'][index % 4] ?? 'bg-primary',
  drift: `${(index % 5) * 12 - 24}px`,
}))

function Counter({ label, value, on }: { label: string; value: string; on: boolean }) {
  return (
    <Card
      size="sm"
      className={cn(
        'gap-0 p-2.5 text-center transition-colors',
        on ? 'bg-primary/8 ring-primary/30' : 'ring-border',
      )}
    >
      <span
        className={cn(
          'block text-sm font-semibold',
          on ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {value}
      </span>
      <span className="mt-0.5 block text-[0.68rem] leading-tight text-muted-foreground">
        {label}
      </span>
    </Card>
  )
}

export default function ReliabilityPanel({
  report,
  status,
  canResume,
  scenarioArmed,
  hasScenarios,
  busy,
  onClose,
  onRunAgain,
  onBreakIt,
  onResumeLast,
}: Props) {
  const grade = GRADE_META[report.grade] // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: report.grade is the ReliabilityGrade union, not user input
  const dash = (report.score / 100) * DIAL_CIRCUMFERENCE

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[88dvh] max-w-[calc(100%-1.5rem)] gap-0 overflow-x-hidden overflow-y-auto sm:max-w-3xl"
      >
        {report.puzzle_solved && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {CONFETTI.map((piece, index) => (
              <span
                key={index}
                className={cn('animate-fall absolute -top-4 h-2.5 w-1.5 rounded-sm', piece.tone)}
                style={
                  {
                    left: piece.left,
                    animationDelay: piece.delay,
                    '--drift': piece.drift,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2 z-10"
          onClick={onClose}
          aria-label="Close the report"
        >
          <X aria-hidden="true" />
        </Button>

        <DialogHeader className="flex-row items-center gap-4 pr-8 pb-5 sm:gap-5 sm:pr-0">
          <div className="relative shrink-0" role="img" aria-label={`Reliability score ${report.score} out of 100`}>
            <svg viewBox="0 0 110 110" className="size-24 -rotate-90">
              <circle
                className="fill-none stroke-muted"
                strokeWidth="9"
                cx="55"
                cy="55"
                r={DIAL_RADIUS}
              />
              <circle
                className={cn('fill-none transition-all duration-700', grade.stroke)}
                strokeWidth="9"
                strokeLinecap="round"
                cx="55"
                cy="55"
                r={DIAL_RADIUS}
                strokeDasharray={`${dash} ${DIAL_CIRCUMFERENCE}`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold tabular-nums">
              {report.score}
            </span>
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {report.puzzle_solved
                ? 'Puzzle solved'
                : status === 'safely_stopped'
                  ? 'Stopped safely'
                  : 'Run finished'}
            </p>
            <DialogTitle
              className={cn('mt-1 flex items-center gap-2 text-xl font-semibold', grade.text)}
            >
              <grade.Icon aria-hidden="true" className="size-5" />
              {grade.title}
            </DialogTitle>
            <DialogDescription className="mt-1 leading-relaxed">{grade.blurb}</DialogDescription>
          </div>
        </DialogHeader>

        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Counter
            label="retries used"
            value={String(report.retries_used)}
            on={report.retries_used > 0}
          />
          <Counter label="repairs" value={String(report.repairs_used ?? 0)} on={(report.repairs_used ?? 0) > 0} />
          <Counter label="fallback" value={report.fallback_used ? 'used' : 'not used'} on={report.fallback_used} />
          <Counter
            label="human review"
            value={report.human_review_used ? 'used' : 'not used'}
            on={report.human_review_used}
          />
          <Counter
            label="safe stop"
            value={report.safe_stop_used ? 'used' : 'not used'}
            on={report.safe_stop_used}
          />
          <Counter
            label="injected failure"
            value={
              report.injected_failure_handled === null
                ? 'none armed'
                : report.injected_failure_handled
                  ? 'handled'
                  : 'not handled'
            }
            on={report.injected_failure_handled === true}
          />
        </div>

        <div className="mb-5 grid gap-5 sm:grid-cols-2">
          <section className="space-y-2">
            <SectionHeading Icon={ListChecks} tone="text-success">
              Completion criteria
            </SectionHeading>
            <ul className="space-y-1.5 text-sm">
              {report.completion.map((entry) => (
                <li key={entry.criterion} className="flex items-start gap-2 leading-relaxed">
                  {entry.met ? (
                    <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-success" />
                  ) : (
                    <X aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  )}
                  <span className={entry.met ? '' : 'text-muted-foreground'}>{entry.criterion}</span>
                </li>
              ))}
              {report.completion.length === 0 && (
                <li className="text-muted-foreground">
                  This run had no puzzle criteria attached.
                </li>
              )}
            </ul>
          </section>

          <section className="space-y-4">
            <div className="space-y-2">
              <SectionHeading Icon={Sparkles} tone="text-success">
                What went well
              </SectionHeading>
              <ul className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                {report.strengths.map((strength) => (
                  <li key={strength}>{strength}</li>
                ))}
                {report.strengths.length === 0 && <li>Nothing to celebrate yet.</li>}
              </ul>
            </div>

            <div className="space-y-2">
              <SectionHeading Icon={TriangleAlert} tone="text-status-paused">
                Still fragile
              </SectionHeading>
              <ul className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                {report.weaknesses.map((weakness) => (
                  <li key={weakness}>{weakness}</li>
                ))}
                {report.weaknesses.length === 0 && <li>Nothing obvious left to shore up.</li>}
              </ul>
            </div>

            {report.unhandled_errors.length > 0 && (
              <div className="space-y-2">
                <SectionHeading Icon={OctagonAlert} tone="text-status-failed">
                  Unhandled errors
                </SectionHeading>
                <ul className="space-y-1.5 text-sm leading-relaxed text-status-failed">
                  {report.unhandled_errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          {canResume && (
            <Button variant="outline" onClick={onResumeLast} disabled={busy}>
              <History aria-hidden="true" />
              Resume from last successful step
            </Button>
          )}
          {hasScenarios && !scenarioArmed && (
            <Button variant="outline" onClick={onBreakIt} disabled={busy}>
              <FlaskConical aria-hidden="true" />
              Break it and see
            </Button>
          )}
          <Button onClick={onRunAgain} disabled={busy}>
            {busy ? (
              <Loader aria-hidden="true" className="animate-spin" />
            ) : (
              <Play aria-hidden="true" />
            )}
            Run again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
