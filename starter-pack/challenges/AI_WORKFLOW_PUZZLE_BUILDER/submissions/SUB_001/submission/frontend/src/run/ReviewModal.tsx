/**
 * The human-in-the-loop gate. The run is frozen server-side until this
 * resolves, so the dialog is deliberately blocking: approve, edit or reject.
 */

import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Loader,
  OctagonX,
  PencilLine,
  TriangleAlert,
  Undo2,
  UserCheck,
} from 'lucide-react'
import type { ReviewDecisionRequest, ReviewRequest } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { stringify } from './payload'

interface Props {
  request: ReviewRequest
  busy: boolean
  onDecide: (decision: ReviewDecisionRequest) => void
}

type Mode = 'choose' | 'edit' | 'reject'

const ACTION_ORDER = ['approve', 'edit', 'reject'] as const
type Action = (typeof ACTION_ORDER)[number]

export default function ReviewModal({ request, busy, onDecide }: Props) {
  const [mode, setMode] = useState<Mode>('choose')
  const [draft, setDraft] = useState(() => stringify(request.data))
  const [note, setNote] = useState('')

  const parsed = useMemo<{ ok: true; value: unknown } | { ok: false; error: string }>(() => {
    try {
      return { ok: true, value: JSON.parse(draft) as unknown }
    } catch (cause) {
      return { ok: false, error: cause instanceof Error ? cause.message : 'That is not valid JSON.' }
    }
  }, [draft])

  const allowed = new Set(
    request.allowed_actions.length > 0 ? request.allowed_actions : [...ACTION_ORDER],
  )
  const can = (action: Action) => allowed.has(action)
  const issues = request.validation?.issues ?? []

  return (
    <Dialog open modal>
      <DialogContent
        showCloseButton={false}
        className="max-h-[86dvh] max-w-[calc(100%-1.5rem)] gap-0 overflow-x-hidden overflow-y-auto sm:max-w-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="flex-row items-start gap-3 pb-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-status-paused/12 text-status-paused">
            <UserCheck aria-hidden="true" className="size-4.5" />
          </span>
          <div className="min-w-0">
            <DialogTitle>Your call</DialogTitle>
            <DialogDescription>
              {request.node_label} paused the run - nothing else happens until you decide.
            </DialogDescription>
          </div>
        </DialogHeader>

        <p className="mb-4 rounded-xl bg-muted p-3 text-sm leading-relaxed">{request.prompt}</p>

        {issues.length > 0 && (
          <section className="mb-4 rounded-xl bg-status-paused/8 p-3 ring-1 ring-status-paused/25">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-status-paused">
              <TriangleAlert aria-hidden="true" className="size-3.5" />
              The validator flagged this data
            </h3>
            <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
              {issues.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>
                  <code className="rounded bg-muted px-1 py-0.5">{issue.field ?? 'output'}</code>{' '}
                  {issue.message}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {mode === 'edit' ? 'Edit the data before it continues' : 'Data awaiting your review'}
            </h3>
            {mode === 'edit' && (
              <Button variant="ghost" size="xs" onClick={() => setDraft(stringify(request.data))}>
                <Undo2 aria-hidden="true" />
                Revert
              </Button>
            )}
          </div>

          {mode === 'edit' ? (
            <>
              <Textarea
                className={cn('font-mono text-xs', !parsed.ok && 'border-destructive')}
                value={draft}
                spellCheck={false}
                rows={12}
                onChange={(event) => setDraft(event.target.value)}
                aria-label="Edited data as JSON"
              />
              <p className={cn('text-xs', parsed.ok ? 'text-muted-foreground' : 'text-destructive')}>
                {parsed.ok ? 'Valid JSON - good to go.' : `Not valid JSON yet: ${parsed.error}`}
              </p>
            </>
          ) : (
            <pre className="max-h-64 overflow-auto rounded-xl bg-muted p-3 text-xs leading-relaxed break-words whitespace-pre-wrap">
              {stringify(request.data)}
            </pre>
          )}
        </section>

        {mode === 'reject' && (
          <section className="mb-4 space-y-2">
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Why are you rejecting it?
            </h3>
            <Textarea
              rows={3}
              value={note}
              placeholder="The refund amount is wrong."
              onChange={(event) => setNote(event.target.value)}
              aria-label="Rejection note"
            />
            <p className="text-xs text-muted-foreground">
              This note is recorded in the trace and the reliability report.
            </p>
          </section>
        )}

        <DialogFooter>
          {mode !== 'choose' && (
            <Button variant="ghost" onClick={() => setMode('choose')} disabled={busy}>
              <ArrowLeft aria-hidden="true" />
              Back
            </Button>
          )}

          {mode === 'choose' && (
            <>
              {can('reject') && (
                <Button variant="destructive" onClick={() => setMode('reject')} disabled={busy}>
                  <OctagonX aria-hidden="true" />
                  Reject
                </Button>
              )}
              {can('edit') && (
                <Button variant="outline" onClick={() => setMode('edit')} disabled={busy}>
                  <PencilLine aria-hidden="true" />
                  Edit
                </Button>
              )}
              {can('approve') && (
                <Button disabled={busy} onClick={() => onDecide({ action: 'approve' })}>
                  {busy ? (
                    <Loader aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Check aria-hidden="true" />
                  )}
                  Approve
                </Button>
              )}
            </>
          )}

          {mode === 'edit' && (
            <Button
              disabled={busy || !parsed.ok}
              onClick={() => parsed.ok && onDecide({ action: 'edit', edited_data: parsed.value })}
            >
              {busy ? (
                <Loader aria-hidden="true" className="animate-spin" />
              ) : (
                <PencilLine aria-hidden="true" />
              )}
              Save and continue
            </Button>
          )}

          {mode === 'reject' && (
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                onDecide({ action: 'reject', ...(note.trim() ? { note: note.trim() } : {}) })
              }
            >
              {busy ? (
                <Loader aria-hidden="true" className="animate-spin" />
              ) : (
                <OctagonX aria-hidden="true" />
              )}
              Reject and stop safely
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
