import { Queue, Worker } from "bullmq"
import { z } from "zod"
import type { AppEnv } from "./env.ts"

export const processUploadJobName = "process-upload"

export const ProcessJobPayloadSchema = z.object({
  jobId: z.string().uuid(),
  uploadId: z.string().uuid(),
})

export type ProcessJobPayload = z.infer<typeof ProcessJobPayloadSchema>

export function createRedisConnectionOptions(env: AppEnv) {
  return {
    host: env.redisHost,
    port: env.redisPort,
    maxRetriesPerRequest: null,
    tls: env.redisTlsEnabled
      ? {
          servername: env.redisHost,
        }
      : undefined,
  }
}

export function createJobQueue(env: AppEnv) {
  return new Queue<ProcessJobPayload>(env.appConfig.queueName, {
    connection: createRedisConnectionOptions(env),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2_000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  })
}

export function createJobWorker(
  env: AppEnv,
  processor: (payload: ProcessJobPayload) => Promise<unknown>
) {
  return new Worker<ProcessJobPayload>(
    env.appConfig.queueName,
    async (job) => processor(ProcessJobPayloadSchema.parse(job.data)),
    {
      connection: createRedisConnectionOptions(env),
      concurrency: 2,
    }
  )
}
