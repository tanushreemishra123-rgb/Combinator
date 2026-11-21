import { cn } from "cn"
import { Skeleton } from "@/components/ui/skeleton"

interface LoadingStateProps {
  lines?: number
  label?: string
  className?: string
}

export function LoadingState({ lines = 3, label = "Loading", className }: LoadingStateProps) {
  return (
    <div role="status" aria-label={label} className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className="h-4 w-full last:w-2/3" />
      ))}
    </div>
  )
}
