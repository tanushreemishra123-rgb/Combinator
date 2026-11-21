/** Live/mock pill driven by `GET /api/health`. Hidden until health answers. */

import { Bot, Sparkles } from 'lucide-react'
import { useHealth } from '@/hooks/useHealth'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** `groq:openai/gpt-oss-120b` → `groq`; the vendor is what the badge names. */
function providerName(provider: string): string {
  return provider.split(':')[0].trim()
}

export default function ModeBadge({ className }: { className?: string }) {
  const health = useHealth()
  if (!health) return null

  const mock = health.mode === 'mock'
  const Icon = mock ? Bot : Sparkles
  const name = providerName(health.provider)
  const label = mock ? 'Mock AI' : name ? `Live AI · ${name}` : 'Live AI'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-4xl px-2.5 text-xs font-medium',
            mock ? 'bg-warning/12 text-warning' : 'bg-success/12 text-success',
            className,
          )}
        >
          <Icon aria-hidden="true" className="size-3.5" />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Provider: {health.provider}
        {mock ? ' - deterministic, no API key needed' : ''}
      </TooltipContent>
    </Tooltip>
  )
}
