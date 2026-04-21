import type { Pool } from "pg"
import {
  JobRecordSchema,
  JobStatsSchema,
  JobSummarySchema,
  type JobRecord,
  type JobStats,
  type JobSummary,
} from "@shared/contracts.ts"

const joinedJobSelect = `
  select
    j.id as job_id,
    j.label as job_label,
    j.status as job_status,
    j.result_s3_key,
    j.summary_json,
    j.error_message,
    j.created_at as job_created_at,
    j.updated_at as job_updated_at,
    u.id as upload_id,
    u.s3_key as upload_s3_key,
    u.original_name,
    u.content_type,
    u.size_bytes,
    u.created_at as upload_created_at
  from jobs j
  inner join uploads u on u.id = j.upload_id
`

type CreateJobInput = {
  jobId: string
  uploadId: string
  label: string
  uploadKey: string
  originalName: string
  contentType: string
  sizeBytes: number
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  return new Date(String(value)).toISOString()
}

function parseSummary(summary: unknown) {
  if (summary === null || summary === undefined) {
    return null
  }

  if (typeof summary === "string") {
    return JobSummarySchema.parse(JSON.parse(summary))
  }

  return JobSummarySchema.parse(summary)
}

function mapJobRow(row: Record<string, unknown>): JobRecord {
  return JobRecordSchema.parse({
    id: row.job_id,
    label: row.job_label,
    status: row.job_status,
    resultS3Key: row.result_s3_key,
    summary: parseSummary(row.summary_json),
    errorMessage: row.error_message,
    createdAt: toIsoString(row.job_created_at),
    updatedAt: toIsoString(row.job_updated_at),
    upload: {
      id: row.upload_id,
      s3Key: row.upload_s3_key,
      originalName: row.original_name,
      contentType: row.content_type,
      sizeBytes: Number(row.size_bytes),
      createdAt: toIsoString(row.upload_created_at),
    },
  })
}

export async function ensureSchema(pool: Pool) {
  await pool.query(`
    create table if not exists uploads (
      id uuid primary key,
      s3_key text not null unique,
      original_name text not null,
      content_type text not null,
      size_bytes bigint not null check (size_bytes >= 0),
      created_at timestamptz not null default now()
    );

    create table if not exists jobs (
      id uuid primary key,
      upload_id uuid not null references uploads(id) on delete cascade,
      label text not null,
      status text not null check (status in ('queued', 'processing', 'completed', 'failed')),
      result_s3_key text,
      summary_json jsonb,
      error_message text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists jobs_created_at_idx on jobs (created_at desc);
    create index if not exists jobs_status_idx on jobs (status);
  `)
}

export async function createJobWithUpload(pool: Pool, input: CreateJobInput) {
  const client = await pool.connect()

  try {
    await client.query("begin")

    await client.query(
      `
        insert into uploads (id, s3_key, original_name, content_type, size_bytes)
        values ($1, $2, $3, $4, $5)
      `,
      [
        input.uploadId,
        input.uploadKey,
        input.originalName,
        input.contentType,
        input.sizeBytes,
      ]
    )

    await client.query(
      `
        insert into jobs (id, upload_id, label, status)
        values ($1, $2, $3, 'queued')
      `,
      [input.jobId, input.uploadId, input.label]
    )

    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

export async function getJobById(pool: Pool, jobId: string) {
  const result = await pool.query(
    `
      ${joinedJobSelect}
      where j.id = $1
    `,
    [jobId]
  )

  if (result.rowCount === 0) {
    return null
  }

  return mapJobRow(result.rows[0])
}

export async function listJobs(pool: Pool, limit = 20) {
  const result = await pool.query(
    `
      ${joinedJobSelect}
      order by j.created_at desc
      limit $1
    `,
    [limit]
  )

  return result.rows.map((row) => mapJobRow(row))
}

export async function getJobStats(pool: Pool): Promise<JobStats> {
  const result = await pool.query(`
    select
      count(*)::int as total,
      count(*) filter (where status = 'queued')::int as queued,
      count(*) filter (where status = 'processing')::int as processing,
      count(*) filter (where status = 'completed')::int as completed,
      count(*) filter (where status = 'failed')::int as failed
    from jobs
  `)

  return JobStatsSchema.parse(result.rows[0])
}

export async function markJobProcessing(pool: Pool, jobId: string) {
  await pool.query(
    `
      update jobs
      set status = 'processing',
          updated_at = now(),
          error_message = null
      where id = $1
    `,
    [jobId]
  )
}

export async function markJobCompleted(
  pool: Pool,
  jobId: string,
  resultS3Key: string,
  summary: JobSummary
) {
  await pool.query(
    `
      update jobs
      set status = 'completed',
          result_s3_key = $2,
          summary_json = $3::jsonb,
          error_message = null,
          updated_at = now()
      where id = $1
    `,
    [jobId, resultS3Key, JSON.stringify(summary)]
  )
}

export async function markJobFailed(
  pool: Pool,
  jobId: string,
  errorMessage: string
) {
  await pool.query(
    `
      update jobs
      set status = 'failed',
          error_message = $2,
          updated_at = now()
      where id = $1
    `,
    [jobId, errorMessage]
  )
}
