/**
 * "Break it" - arm one of the puzzle's failure scenarios before running.
 *
 * Off by default. Armed it turns loud, because a reviewer needs to see at a
 * glance that the next run is deliberately sabotaged.
 */

import { FlaskConical, Zap } from 'lucide-react'
import type { FailureScenario } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const NONE = '__none__'

interface Props {
  scenarios: FailureScenario[]
  value: string | null
  onChange: (scenarioId: string | null) => void
  disabled: boolean
  /** Narrow layout: the trigger shrinks to its icon and grows a tooltip. */
  compact?: boolean
}

export default function ScenarioToggle({
  scenarios,
  value,
  onChange,
  disabled,
  compact = false,
}: Props) {
  if (scenarios.length === 0) return null

  const armed = scenarios.find((scenario) => scenario.id === value) ?? null
  const hint = armed
    ? `Break it: ${armed.label} - ${armed.description}`
    : 'Arm a failure scenario and watch your guards earn their keep'

  const trigger = (
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        size={compact ? 'icon-sm' : 'sm'}
        disabled={disabled}
        title={armed ? armed.description : hint}
        aria-label={compact ? hint : undefined}
        className={cn(
          compact ? 'relative' : 'max-w-64',
          armed && 'border-status-retrying/45 bg-status-retrying/10 text-status-retrying',
        )}
      >
        <FlaskConical aria-hidden="true" />
        {compact ? (
          armed && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-status-retrying ring-2 ring-card"
            />
          )
        ) : (
          <span className="truncate">Break it{armed ? `: ${armed.label}` : ''}</span>
        )}
      </Button>
    </DropdownMenuTrigger>
  )

  return (
    <DropdownMenu>
      {compact ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-64">
            {hint}
          </TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}

      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1.5rem)]">
        <DropdownMenuLabel>Arm a failure scenario</DropdownMenuLabel>
        <p className="px-1.5 pb-1.5 text-xs leading-snug text-muted-foreground">
          The engine injects this fault on the next run. A workflow with the right guards should
          survive it.
        </p>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value ?? NONE}
          onValueChange={(next) => onChange(next === NONE ? null : next)}
        >
          <DropdownMenuRadioItem value={NONE} className="items-start py-1.5">
            <span className="min-w-0">
              <span className="block font-medium">Nothing - run it clean</span>
              <span className="block text-xs text-muted-foreground">No fault injected.</span>
            </span>
          </DropdownMenuRadioItem>

          {scenarios.map((scenario) => (
            <DropdownMenuRadioItem
              key={scenario.id}
              value={scenario.id}
              className="items-start py-1.5"
            >
              <Zap aria-hidden="true" className="mt-0.5 text-status-retrying" />
              <span className="min-w-0">
                <span className="block font-medium">{scenario.label}</span>
                <span className="block text-xs leading-snug text-muted-foreground">
                  {scenario.description}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
