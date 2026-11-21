/** The clickable error/warning rows inside a "Check workflow" toast. */

import { CircleX, TriangleAlert } from 'lucide-react'
import type { ValidateWorkflowResponse, ValidationMessage } from '@/api/types'
import { cn } from '@/lib/utils'

function MessageRow({
  message,
  tone,
  onFocusNode,
}: {
  message: ValidationMessage
  tone: 'error' | 'warning'
  onFocusNode: (nodeId: string) => void
}) {
  const Icon = tone === 'error' ? CircleX : TriangleAlert
  const body = (
    <>
      <Icon
        aria-hidden="true"
        className={cn(
          'mt-0.5 size-3.5 shrink-0',
          tone === 'error' ? 'text-status-failed' : 'text-status-paused',
        )}
      />
      <span className="flex-1">{message.message}</span>
    </>
  )

  const nodeId = message.node_id
  const shared =
    'flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left text-xs leading-snug text-foreground'

  return nodeId ? (
    <button
      type="button"
      className={cn(shared, 'transition-colors hover:bg-muted')}
      onClick={() => onFocusNode(nodeId)}
    >
      {body}
      <span className="shrink-0 font-medium text-primary">show</span>
    </button>
  ) : (
    <div className={shared}>{body}</div>
  )
}

export default function ValidationMessages({
  result,
  onFocusNode,
}: {
  result: ValidateWorkflowResponse
  onFocusNode: (nodeId: string) => void
}) {
  return (
    <div className="mt-1 max-h-52 space-y-0.5 overflow-auto">
      {result.errors.map((message, index) => (
        <MessageRow key={`e${index}`} message={message} tone="error" onFocusNode={onFocusNode} />
      ))}
      {result.warnings.map((message, index) => (
        <MessageRow key={`w${index}`} message={message} tone="warning" onFocusNode={onFocusNode} />
      ))}
    </div>
  )
}

