import { useCallback, useEffect, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { AlertTriangle, ArrowLeft, RefreshCcw } from "lucide-react"
import { getJob } from "@/lib/api.ts"
import {
  formatBytes,
  formatDateTime,
  formatRelativeTime,
  truncateMiddle,
} from "@/lib/format.ts"
import { StatusBadge } from "@/components/app/status-badge.tsx"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Progress } from "@/components/ui/progress.tsx"
import { Textarea } from "@/components/ui/textarea.tsx"

export const Route = createFileRoute("/jobs/$jobId")({
  loader: ({ params }) => getJob(params.jobId),
  component: JobDetailPage,
})

function JobDetailPage() {
  const loaderData = Route.useLoaderData()
  const { jobId } = Route.useParams()
  const [job, setJob] = useState(loaderData.job)
  const [pollError, setPollError] = useState<string | null>(null)
  const currentJob = job.id === loaderData.job.id ? job : loaderData.job

  const refreshJob = useCallback(async () => {
    try {
      const response = await getJob(jobId)
      setJob(response.job)
      setPollError(null)
    } catch (error) {
      setPollError(
        error instanceof Error ? error.message : "Could not refresh the job."
      )
    }
  }, [jobId])

  useEffect(() => {
    if (currentJob.status === "completed" || currentJob.status === "failed") {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      void refreshJob()
    }, 3_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [currentJob.status, refreshJob])

  const progressValue =
    currentJob.status === "queued"
      ? 18
      : currentJob.status === "processing"
        ? 67
        : 100

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Dashboard
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <h2 className="text-lg font-semibold">{currentJob.label}</h2>
          <StatusBadge status={currentJob.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Created {formatRelativeTime(currentJob.createdAt)}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void refreshJob()
          }}
        >
          <RefreshCcw className="size-3.5" />
          Refresh
        </Button>
      </div>

      {pollError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Polling stalled</AlertTitle>
          <AlertDescription>{pollError}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-6">
        <div>
          <h3 className="text-sm font-medium">Job record</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="ID" value={truncateMiddle(currentJob.id, 28)} mono />
            <Row label="Created" value={formatDateTime(currentJob.createdAt)} />
            <Row label="Updated" value={formatDateTime(currentJob.updatedAt)} />
            <Row label="File" value={currentJob.upload.originalName} />
          </dl>
        </div>

        <div>
          <h3 className="text-sm font-medium">Upload</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Content type" value={currentJob.upload.contentType} />
            <Row label="Size" value={formatBytes(currentJob.upload.sizeBytes)} />
            <Row label="Source key" value={truncateMiddle(currentJob.upload.s3Key, 48)} mono />
            <Row
              label="Result key"
              value={
                currentJob.resultS3Key
                  ? truncateMiddle(currentJob.resultS3Key, 48)
                  : "—"
              }
              mono
            />
          </dl>
        </div>
      </section>

      {currentJob.status === "queued" || currentJob.status === "processing" ? (
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Worker progress</h3>
          <Progress value={progressValue} />
          <p className="text-sm text-muted-foreground">
            {currentJob.status === "queued"
              ? "Waiting for worker pickup."
              : "Processing file and writing results."}
          </p>
        </section>
      ) : null}

      {currentJob.status === "failed" && currentJob.errorMessage ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Failed</AlertTitle>
          <AlertDescription>{currentJob.errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {currentJob.summary ? (
        <section className="space-y-6">
          <div>
            <h3 className="text-sm font-medium">Summary</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Bytes" value={formatBytes(currentJob.summary.byteCount)} />
              <Row label="Lines" value={String(currentJob.summary.lineCount)} />
              <Row label="Words" value={String(currentJob.summary.wordCount)} />
              <Row label="Processed" value={formatDateTime(currentJob.summary.processedAt)} />
              <Row label="SHA-256" value={currentJob.summary.checksumSha256} mono />
            </dl>
          </div>

          <div>
            <h3 className="text-sm font-medium">Preview</h3>
            <Textarea
              readOnly
              className="mt-3 min-h-56 resize-none font-mono text-xs leading-6"
              value={currentJob.summary.previewLines.join("\n")}
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`text-right break-all ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  )
}
