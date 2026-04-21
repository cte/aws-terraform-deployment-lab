import { LoaderCircle } from "lucide-react"
import type { JobStatus } from "@shared/contracts.ts"
import { cn } from "@/lib/utils"

const statusConfig: Record<JobStatus, { label: string; dotClass: string }> = {
  queued: {
    label: "Queued",
    dotClass: "bg-amber-500",
  },
  processing: {
    label: "Processing",
    dotClass: "bg-sky-500",
  },
  completed: {
    label: "Completed",
    dotClass: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    dotClass: "bg-red-500",
  },
}

type StatusBadgeProps = {
  status: JobStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        className
      )}
    >
      {status === "processing" ? (
        <LoaderCircle className="size-3 animate-spin text-sky-500 [animation-duration:1.6s]" />
      ) : (
        <span className={cn("size-1.5 rounded-full", config.dotClass)} />
      )}
      {config.label}
    </span>
  )
}
