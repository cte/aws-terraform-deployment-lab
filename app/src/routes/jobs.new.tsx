import { startTransition, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { createJob, getMeta } from "@/lib/api.ts"
import { formatBytes } from "@/lib/format.ts"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Label } from "@/components/ui/label.tsx"
import { Progress } from "@/components/ui/progress.tsx"

export const Route = createFileRoute("/jobs/new")({
  loader: () => getMeta(),
  component: NewJobPage,
})

function NewJobPage() {
  const meta = Route.useLoaderData()
  const navigate = useNavigate()
  const [label, setLabel] = useState("Fresh import")
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!file) {
      toast.error("Choose a file before creating a job.")
      return
    }

    const formData = new FormData()
    formData.set("label", label)
    formData.set("file", file)

    setIsSubmitting(true)

    try {
      const response = await createJob(formData)

      toast.success("Job queued. The worker should pick it up shortly.")

      startTransition(() => {
        void navigate({
          to: "/jobs/$jobId",
          params: { jobId: response.job.id },
        })
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Job creation failed."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-md space-y-8">
      <div>
        <h2 className="text-lg font-semibold">New job</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a text or CSV file. It will be stored in S3, queued via Redis,
          and processed by the worker.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="label">Label</Label>
          <Input
            id="label"
            name="label"
            value={label}
            maxLength={80}
            onChange={(event) => {
              setLabel(event.target.value)
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="file">File</Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
            }}
          />
          <p className="text-xs text-muted-foreground">
            Max {formatBytes(meta.maxUploadBytes)}. Text or CSV only.
          </p>
        </div>

        {file ? (
          <p className="text-sm text-muted-foreground">
            {file.name} · {formatBytes(file.size)}
          </p>
        ) : null}

        {isSubmitting ? (
          <div className="space-y-2">
            <Progress value={68} />
            <p className="text-xs text-muted-foreground">Uploading...</p>
          </div>
        ) : null}

        <Button type="submit" disabled={!file || isSubmitting}>
          {isSubmitting ? "Submitting..." : "Upload and enqueue"}
        </Button>
      </form>
    </div>
  )
}
