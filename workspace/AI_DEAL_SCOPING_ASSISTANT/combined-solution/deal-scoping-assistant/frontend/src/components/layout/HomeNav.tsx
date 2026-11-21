import { FolderOpenIcon, LayoutGridIcon } from "lucide-react"
import { NavLink } from "react-router"
import { cn } from "cn"

const LINKS = [
  { to: "/", label: "Sessions", Icon: FolderOpenIcon },
  { to: "/scenarios", label: "Sample scenarios", Icon: LayoutGridIcon },
] as const

/** Sidebar navigation for the pages outside a session. */
export function HomeNav() {
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col">
      {LINKS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
              isActive
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent",
            )
          }
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
