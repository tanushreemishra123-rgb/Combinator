import { useState } from "react"
import type { ReactNode } from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface SectionCardProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
}

// Open or closed per card and page, kept while the reviewer moves around the session.
const openState = new Map<string, boolean>()

function stateKey(title: ReactNode): string | null {
  if (typeof title !== "string") return null
  return `${window.location.pathname}#${title}`
}

/** A titled card whose body folds away; the header, its actions and the badge stay put. */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: SectionCardProps) {
  const key = stateKey(title)
  const [open, setOpen] = useState(() => (key ? (openState.get(key) ?? true) : true))
  const toggle = (next: boolean) => {
    setOpen(next)
    if (key) openState.set(key, next)
  }

  return (
    <Card className={className}>
      <CardHeader
        // The whole header toggles the card; the chevron is the keyboard-reachable trigger.
        className="cursor-pointer select-none"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("[data-slot=card-action]")) return
          toggle(!open)
        }}
      >
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        <CardAction className="flex items-center gap-2">
          {actions}
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-primary hover:bg-primary/10 hover:text-primary"
            aria-expanded={open}
            aria-label={open ? "Collapse section" : "Expand section"}
            onClick={() => toggle(!open)}
          >
            <ChevronDownIcon
              className={cn("transition-transform duration-300", open && "rotate-180")}
            />
          </Button>
        </CardAction>
      </CardHeader>
      {children ? (
        // Kept mounted and animated with a grid-row transition: the body's tables and
        // diagrams are not rebuilt on every expand, so the motion stays smooth.
        <div
          data-slot="section-body"
          data-state={open ? "open" : "closed"}
          inert={!open}
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <CardContent className="pt-(--card-spacing)">{children}</CardContent>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
