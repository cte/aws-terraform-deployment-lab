import { z } from "zod"

export const jobStatusValues = [
  "queued",
  "processing",
  "completed",
  "failed",
] as const

export const JobStatusSchema = z.enum(jobStatusValues)

export const JobLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .catch("Fresh import")

export const JobSummarySchema = z.object({
  byteCount: z.number().int().nonnegative(),
  lineCount: z.number().int().nonnegative(),
  wordCount: z.number().int().nonnegative(),
  checksumSha256: z.string().length(64),
  contentType: z.string(),
  previewLines: z.array(z.string()).max(5),
  processedAt: z.string().datetime(),
})

export const UploadRecordSchema = z.object({
  id: z.string().uuid(),
  s3Key: z.string(),
  originalName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
})

export const JobRecordSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  status: JobStatusSchema,
  resultS3Key: z.string().nullable(),
  summary: JobSummarySchema.nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  upload: UploadRecordSchema,
})

export const JobStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  queued: z.number().int().nonnegative(),
  processing: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
})

export const JobsResponseSchema = z.object({
  jobs: z.array(JobRecordSchema),
  stats: JobStatsSchema,
})

export const JobResponseSchema = z.object({
  job: JobRecordSchema,
})

export const CreateJobResponseSchema = z.object({
  job: JobRecordSchema,
})

export const AppMetaSchema = z.object({
  appName: z.string(),
  environment: z.string(),
  awsRegion: z.string(),
  bucketName: z.string(),
  databaseHost: z.string(),
  queueName: z.string(),
  uploadPrefix: z.string(),
  resultPrefix: z.string(),
  maxUploadBytes: z.number().int().positive(),
  redisTlsEnabled: z.boolean(),
})

export type AppMeta = z.infer<typeof AppMetaSchema>
export type CreateJobResponse = z.infer<typeof CreateJobResponseSchema>
export type JobRecord = z.infer<typeof JobRecordSchema>
export type JobStats = z.infer<typeof JobStatsSchema>
export type JobStatus = z.infer<typeof JobStatusSchema>
export type JobSummary = z.infer<typeof JobSummarySchema>
export type JobsResponse = z.infer<typeof JobsResponseSchema>
