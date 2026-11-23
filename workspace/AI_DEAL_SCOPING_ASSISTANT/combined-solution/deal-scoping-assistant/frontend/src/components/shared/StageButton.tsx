import type { ComponentProps, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

interface StageButtonProps extends ComponentProps<typeof Button> {
  running?: boolean
  /** What the backend is doing right now, e.g. "Analysing requirements". */
  stage?: string
  children: ReactNode
}

// Live AI stages can take up to two minutes, so the button always says what is happening.
export function StageButton({
  running = false,
  stage,
  children,
  disabled,
  ...props
}: StageButtonProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled={disabled || running} aria-busy={running} {...props}>
        {running ? <Spinner data-icon="inline-start" /> : null}
        {children}
      </Button>
      {running && stage ? (
        <span role="status" className="shimmer text-sm text-muted-foreground">
          {stage}
        </span>
      ) : null}
    </div>
  )
}
