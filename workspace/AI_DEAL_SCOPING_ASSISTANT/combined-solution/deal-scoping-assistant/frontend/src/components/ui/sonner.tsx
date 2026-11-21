import type { CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useDarkTheme } from "@/lib/useDarkTheme"

// shadcn's version reads next-themes; this app keeps its theme on the root class instead.
const Toaster = ({ ...props }: ToasterProps) => {
  const dark = useDarkTheme()

  return (
    <Sonner
      theme={dark ? "dark" : "light"}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      // Success, warning and error toasts use the app's own semantic colors, not Sonner's.
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          success:
            "border-success/40! bg-[color-mix(in_oklab,var(--color-success)_15%,var(--popover))]! text-success! [&_[data-icon]]:text-success!",
          warning:
            "border-warning/40! bg-[color-mix(in_oklab,var(--color-warning)_15%,var(--popover))]! text-warning! [&_[data-icon]]:text-warning!",
          error:
            "border-danger/40! bg-[color-mix(in_oklab,var(--color-danger)_15%,var(--popover))]! text-danger! [&_[data-icon]]:text-danger!",
          info: "border-info/40! bg-[color-mix(in_oklab,var(--color-info)_15%,var(--popover))]! text-info! [&_[data-icon]]:text-info!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
