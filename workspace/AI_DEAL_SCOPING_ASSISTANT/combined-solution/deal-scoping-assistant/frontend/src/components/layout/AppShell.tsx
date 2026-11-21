import type { ReactNode } from "react"
import { Link } from "react-router"
import { SidebarFooter } from "@/components/layout/SidebarFooter"
import type { SystemInfo } from "@/api/types"

interface AppShellProps {
  /** What the sidebar shows between the product name and the footer. */
  sidebar: ReactNode
  /** Drives the AI-mode card in the sidebar footer. */
  system?: SystemInfo
  /** Sits above the content, e.g. the way back to the sessions list. */
  topbar?: ReactNode
  /** One-line notice above the content, e.g. that live mode sends customer text away. */
  notice?: ReactNode
  children: ReactNode
}

/** Fixed sidebar on the left; only the content column scrolls. Stacks below `md`. */
export function AppShell({ sidebar, system, topbar, notice, children }: AppShellProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background md:h-svh md:flex-row md:overflow-hidden">
      <aside className="flex flex-col gap-5 border-b bg-sidebar px-4 py-4 md:h-svh md:w-60 md:shrink-0 lg:w-72 md:overflow-y-auto md:border-r md:border-b-0">
        <Link to="/" className="font-heading text-sm font-medium tracking-tight">
          Deal Scoping Assistant
        </Link>
        {sidebar}
        <div className="md:mt-auto">
          <SidebarFooter system={system} />
        </div>
      </aside>
      <div className="min-w-0 flex-1 md:overflow-y-auto">
        <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10">
          {topbar}
          {notice}
          {children}
        </main>
      </div>
    </div>
  )
}
