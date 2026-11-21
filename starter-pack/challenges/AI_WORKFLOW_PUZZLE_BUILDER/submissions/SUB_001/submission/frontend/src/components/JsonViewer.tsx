/** Pretty-printed JSON in a card, with copy-to-clipboard. Used everywhere data is shown. */

import { useCallback, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { stringify } from '@/run/payload'

type JsonTone = 'neutral' | 'good' | 'bad' | 'warn'

const TONE_RING: Record<JsonTone, string> = {
  neutral: 'ring-border',
  good: 'ring-status-completed/30',
  bad: 'ring-status-failed/30',
  warn: 'ring-status-paused/35',
}

const TONE_LABEL: Record<JsonTone, string> = {
  neutral: 'text-muted-foreground',
  good: 'text-status-completed',
  bad: 'text-status-failed',
  warn: 'text-status-paused',
}

interface Props {
  label: string
  value: unknown
  tone?: JsonTone
  className?: string
}

export default function JsonViewer({ label, value, tone = 'neutral', className }: Props) {
  const [copied, setCopied] = useState(false)
  const text = stringify(value)

  const copy = useCallback(() => {
    const done = () => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done, () => setCopied(false))
    } else {
      done()
    }
  }, [text])

  return (
    <section
      className={cn('overflow-hidden rounded-xl bg-card ring-1', /* nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: tone is a union of literal tone names, not user input */ TONE_RING[tone], className)}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/70 py-1 pr-1 pl-3">
        <h4
          className={cn(
            'text-[0.68rem] font-semibold tracking-wider uppercase',
            TONE_LABEL[tone], // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: tone is a union of literal tone names, not user input
          )}
        >
          {label}
        </h4>
        <Button variant="ghost" size="xs" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </header>
      <pre className="max-h-64 overflow-auto p-3 text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
        {text}
      </pre>
    </section>
  )
}
