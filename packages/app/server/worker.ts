import { createPool } from "./db.ts"
import { loadEnv } from "./env.ts"
import { processUploadJob } from "./process-upload.ts"
import { createJobWorker } from "./queue.ts"
import { ensureSchema } from "./repository.ts"
import { createS3Client } from "./storage.ts"

const env = loadEnv()
const pool = createPool(env)
const s3 = createS3Client(env)

await ensureSchema(pool)

const worker = createJobWorker(env, (payload) =>
  processUploadJob(payload, {
    env,
    pool,
    s3,
  })
)

worker.on("ready", () => {
  console.info(
    JSON.stringify({
      level: "info",
      message: "Worker ready.",
      queueName: env.appConfig.queueName,
    })
  )
})

worker.on("completed", (job, result) => {
  console.info(
    JSON.stringify({
      level: "info",
      message: "Job completed.",
      jobId: job.id,
      result,
    })
  )
})

worker.on("failed", (job, error) => {
  console.error(
    JSON.stringify({
      level: "error",
      message: "Job failed.",
      jobId: job?.id,
      error: error.message,
    })
  )
})

async function shutdown(signal: string) {
  console.info(
    JSON.stringify({
      level: "info",
      message: "Shutting down worker.",
      signal,
    })
  )
  await worker.close()
  await pool.end()
  process.exit(0)
}

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})
