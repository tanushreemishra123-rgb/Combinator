import { useEffect, useId, useImperativeHandle, useRef, useState } from "react"
import type { Ref } from "react"
import { cn } from "cn"
import { ZoomInIcon, ZoomOutIcon } from "lucide-react"
import { ErrorState } from "@/components/shared/ErrorState"
import { LoadingState } from "@/components/shared/LoadingState"
import { Button } from "@/components/ui/button"
import { parseSvg, renderMermaid, svgToPngDataUrl } from "@/lib/mermaid"
import type { DiagramTheme } from "@/lib/mermaid"
import { useDarkTheme } from "@/lib/useDarkTheme"

export interface DiagramViewHandle {
  /** PNG data URL of the diagram; waits for the render and rejects when it fails. */
  toPng: (scale?: number) => Promise<string>
}

interface DiagramViewProps {
  source: string
  title: string
  /** "light" for the copies that go into documents, whatever the app theme. */
  theme?: DiagramTheme
  className?: string
  ref?: Ref<DiagramViewHandle>
}

type Waiter = { resolve: (svg: string) => void; reject: (error: Error) => void }

const ZOOM_MIN = 0.5
const ZOOM_MAX = 2.5
const ZOOM_STEP = 0.25

// The rendered source is kept with the result so a source change shows loading, not the old diagram.
interface RenderResult {
  source: string
  svg?: string
  error?: Error
}

export function DiagramView({ source, title, theme = "app", className, ref }: DiagramViewProps) {
  const [result, setResult] = useState<RenderResult | null>(null)
  const [zoom, setZoom] = useState(1)
  const reactId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  // Export callers may ask for the PNG before the first render has finished.
  const waiters = useRef<Waiter[]>([])
  const dark = useDarkTheme()

  useEffect(() => {
    let cancelled = false
    // `dark` is read so a theme switch renders the diagram again in the matching theme.
    void dark
    renderMermaid(reactId, source, theme)
      .then((svg) => {
        if (cancelled) return
        setResult({ source, svg })
        for (const waiter of waiters.current.splice(0)) waiter.resolve(svg)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        const error = cause instanceof Error ? cause : new Error("The diagram source is invalid.")
        setResult({ source, error })
        for (const waiter of waiters.current.splice(0)) waiter.reject(error)
      })
    return () => {
      cancelled = true
    }
  }, [reactId, source, theme, dark])

  const current = result?.source === source ? result : null
  const svg = current?.svg ?? null
  const error = current?.error ?? null

  useEffect(() => {
    if (svg) containerRef.current?.replaceChildren(parseSvg(svg))
  }, [svg])

  // 100% fits the card (or the native size when smaller); setting a pixel width keeps the
  // scroll area in step with the zoom.
  useEffect(() => {
    const container = containerRef.current
    const element = container?.querySelector("svg")
    if (!container || !element) return
    const native = element.viewBox?.baseVal?.width ?? 0
    const fit = Math.min(native || container.clientWidth, container.clientWidth)
    element.style.width = `${fit * zoom}px`
  }, [svg, zoom])

  const step = (delta: number) =>
    setZoom((value) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value + delta)))

  useImperativeHandle(
    ref,
    () => ({
      toPng: async (scale) => {
        if (svg) return svgToPngDataUrl(svg, scale)
        if (error) throw error
        const rendered = await new Promise<string>((resolve, reject) => {
          waiters.current.push({ resolve, reject })
        })
        return svgToPngDataUrl(rendered, scale)
      },
    }),
    [svg, error],
  )

  if (error) return <ErrorState error={error} />
  if (!svg) return <LoadingState lines={4} label={`Rendering ${title}`} />

  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-1 self-end">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Zoom out"
          disabled={zoom <= ZOOM_MIN}
          onClick={() => step(-ZOOM_STEP)}
        >
          <ZoomOutIcon />
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label="Reset zoom"
          className="w-16 tabular-nums"
          onClick={() => setZoom(1)}
        >
          {Math.round(zoom * 100)}%
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Zoom in"
          disabled={zoom >= ZOOM_MAX}
          onClick={() => step(ZOOM_STEP)}
        >
          <ZoomInIcon />
        </Button>
      </div>
      <div
        ref={containerRef}
        role="img"
        aria-label={title}
        // Natural size with a horizontal scroll: a diagram shrunk to fit the card is unreadable.
        className="overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-none!"
      />
      <figcaption className="text-xs text-muted-foreground">{title}</figcaption>
    </figure>
  )
}
