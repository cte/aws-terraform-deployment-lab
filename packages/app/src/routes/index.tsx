import { Link, createFileRoute } from "@tanstack/react-router"
import { PackageX } from "lucide-react"
import { getJobs, getMeta } from "@/lib/api.ts"
import { formatBytes, formatRelativeTime, truncateMiddle } from "@/lib/format.ts"
import { StatusBadge } from "@/components/app/status-badge.tsx"

export const Route = createFileRoute("/")({
  loader: async () => {
    const [meta, jobs] = await Promise.all([getMeta(), getJobs()])

    return {
      meta,
      jobs,
    }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const { meta, jobs } = Route.useLoaderData()

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold">Overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          File-ingest pipeline verification. Upload, queue, process, verify.
        </p>
        <div className="mt-4 flex gap-6">
          <Stat label="Total" value={jobs.stats.total} />
          <Stat label="Queued" value={jobs.stats.queued} />
          <Stat label="Processing" value={jobs.stats.processing} />
          <Stat label="Completed" value={jobs.stats.completed} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Recent jobs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Latest records from Postgres.
        </p>

        {jobs.jobs.length === 0 ? (
          <div className="mt-6 rounded-md border border-dashed border-border py-10 text-center">
            <PackageX className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No jobs yet. Upload a file to get started.
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border">
            {jobs.jobs.map((job) => (
              <Link
                key={job.id}
                to="/jobs/$jobId"
                params={{ jobId: job.id }}
                className="flex items-center justify-between gap-4 py-3 transition hover:opacity-70"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">{job.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {job.upload.originalName} · {formatBytes(job.upload.sizeBytes)} · {formatRelativeTime(job.createdAt)}
                  </p>
                </div>
                <StatusBadge status={job.status} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Environment</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Values from the running Fastify service.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <EnvRow label="Environment" value={meta.environment} />
          <EnvRow label="Region" value={meta.awsRegion} />
          <EnvRow label="S3 bucket" value={meta.bucketName} />
          <EnvRow label="Database" value={truncateMiddle(meta.databaseHost, 40)} />
          <EnvRow label="Queue" value={meta.queueName} />
          <EnvRow label="Upload prefix" value={meta.uploadPrefix} />
          <EnvRow label="Result prefix" value={meta.resultPrefix} />
          <EnvRow label="Max upload" value={formatBytes(meta.maxUploadBytes)} />
          <EnvRow label="Redis TLS" value={meta.redisTlsEnabled ? "enabled" : "disabled"} />
        </dl>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function EnvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono text-xs">{value}</dd>
    </div>
  )
}
