import { BotIcon, MoreVerticalIcon, RadioIcon } from "lucide-react"
import { aiModeLabel, aiTarget, fallbackNotice } from "@/components/layout/aiMode"
import { ThemeMenu } from "@/components/layout/ThemeMenu"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { SystemInfo } from "@/api/types"

const MOCK_DETAIL = "Recorded answers replayed from disk; no customer text leaves this machine."

/** The AI mode as a card at the bottom of the sidebar, with the settings menu on its right. */
export function SidebarFooter({ system }: { system: SystemInfo | undefined }) {
  const live = system?.ai_mode === "live"
  const title = live ? "Live AI" : "Mock mode"
  const subtitle = system
    ? live
      ? aiTarget(system) || "Provider configured"
      : "Recorded responses"
    : "Checking the AI mode"
  const detail = system
    ? (fallbackNotice(system) ?? (live ? "Customer text is sent to this provider." : MOCK_DETAIL))
    : ""
  const Icon = live ? RadioIcon : BotIcon

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background p-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Settings">
            <MoreVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-72">
          {system ? (
            <>
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium">{aiModeLabel(system)}</p>
                <p className="text-xs text-muted-foreground whitespace-normal">{detail}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <ThemeMenu />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
