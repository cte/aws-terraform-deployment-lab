import type { S3Client } from "@aws-sdk/client-s3"
import type { Pool } from "pg"
import type { AppEnv } from "./env.ts"
import type { ProcessJobPayload } from "./queue.ts"
import {
  getJobById,
  markJobCompleted,
  markJobFailed,
  markJobProcessing,
} from "./repository.ts"
import {
  buildSummary,
  createResultKey,
  readObjectBuffer,
  writeSummaryObject,
} from "./storage.ts"

type ProcessUploadJobOptions = {
  env: AppEnv
  pool: Pool
  s3: S3Client
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown worker failure."
}

export async function processUploadJob(
  payload: ProcessJobPayload,
  options: ProcessUploadJobOptions
) {
  await markJobProcessing(options.pool, payload.jobId)

  try {
    const job = await getJobById(options.pool, payload.jobId)

    if (!job) {
      throw new Error(`Job ${payload.jobId} was not found in Postgres.`)
    }

    const sourceBuffer = await readObjectBuffer({
      s3: options.s3,
      bucketName: options.env.s3Bucket,
      key: job.upload.s3Key,
    })
    const summary = buildSummary(sourceBuffer, job.upload.contentType)
    const resultKey = createResultKey(options.env, job.id)

    await writeSummaryObject({
      s3: options.s3,
      bucketName: options.env.s3Bucket,
      key: resultKey,
      summary,
    })

    await markJobCompleted(options.pool, job.id, resultKey, summary)

    return {
      jobId: job.id,
      resultKey,
    }
  } catch (error) {
    await markJobFailed(options.pool, payload.jobId, getErrorMessage(error))
    throw error
  }
}
