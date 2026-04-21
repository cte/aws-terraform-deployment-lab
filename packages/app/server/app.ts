import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import fastifyMultipart from "@fastify/multipart"
import fastifyStatic from "@fastify/static"
import Fastify from "fastify"
import { z } from "zod"
import {
  AppMetaSchema,
  CreateJobResponseSchema,
  JobLabelSchema,
  JobResponseSchema,
  JobsResponseSchema,
} from "@shared/contracts.ts"
import { createPool } from "./db.ts"
import type { AppEnv } from "./env.ts"
import { createJobQueue, processUploadJobName } from "./queue.ts"
import {
  createJobWithUpload,
  ensureSchema,
  getJobById,
  getJobStats,
  listJobs,
  markJobFailed,
} from "./repository.ts"
import {
  createS3Client,
  createUploadKey,
  deleteObject,
  inferContentType,
  sanitizeFileName,
  uploadSourceObject,
} from "./storage.ts"

const clientAssetsRoot = fileURLToPath(new URL("../dist", import.meta.url))
const routeParamsSchema = z.object({
  jobId: z.string().uuid(),
})

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown server failure."
}

function getStatusCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode
  }

  return 500
}

function getMultipartFieldValue(field: unknown) {
  const candidate = Array.isArray(field) ? field[0] : field

  if (
    candidate &&
    typeof candidate === "object" &&
    "type" in candidate &&
    candidate.type === "field" &&
    "value" in candidate
  ) {
    return String(candidate.value ?? "")
  }

  return ""
}

export async function buildServer(env: AppEnv) {
  const app = Fastify({
    logger: {
      level: env.logLevel,
    },
  })
  const pool = createPool(env)
  const s3 = createS3Client(env)
  const queue = createJobQueue(env)

  await ensureSchema(pool)

  await app.register(fastifyMultipart, {
    limits: {
      files: 1,
      fileSize: env.appConfig.maxUploadBytes,
    },
  })

  app.addHook("onClose", async () => {
    await queue.close()
    await pool.end()
  })

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error)

    const statusCode = getStatusCode(error)
    const message =
      statusCode >= 500 ? "Unexpected server error." : getErrorMessage(error)

    void reply.status(statusCode).send({
      error: message,
    })
  })

  app.get("/health", async (_request, reply) => {
    return reply.type("text/plain").send("ok")
  })

  app.get("/api/meta", async () => {
    return AppMetaSchema.parse({
      appName: env.appName,
      environment: env.appEnvironment,
      awsRegion: env.awsRegion,
      bucketName: env.s3Bucket,
      databaseHost: env.dbHost,
      queueName: env.appConfig.queueName,
      uploadPrefix: env.appConfig.uploadPrefix,
      resultPrefix: env.appConfig.resultPrefix,
      maxUploadBytes: env.appConfig.maxUploadBytes,
      redisTlsEnabled: env.redisTlsEnabled,
    })
  })

  app.get("/api/jobs", async () => {
    const [jobs, stats] = await Promise.all([
      listJobs(pool, 25),
      getJobStats(pool),
    ])

    return JobsResponseSchema.parse({
      jobs,
      stats,
    })
  })

  app.get("/api/jobs/:jobId", async (request, reply) => {
    const params = routeParamsSchema.parse(request.params)
    const job = await getJobById(pool, params.jobId)

    if (!job) {
      return reply.status(404).send({
        error: "Job not found.",
      })
    }

    return JobResponseSchema.parse({
      job,
    })
  })

  app.post("/api/jobs", async (request, reply) => {
    const upload = await request.file()

    if (!upload) {
      return reply.status(400).send({
        error: "Select a file before creating a job.",
      })
    }

    const label = JobLabelSchema.parse(
      getMultipartFieldValue(upload.fields.label)
    )
    const uploadBuffer = await upload.toBuffer()

    if (uploadBuffer.byteLength === 0) {
      return reply.status(400).send({
        error: "Empty files are not useful for this test.",
      })
    }

    const jobId = randomUUID()
    const uploadId = randomUUID()
    const safeFileName = sanitizeFileName(upload.filename ?? `${jobId}.txt`)
    const contentType = inferContentType(upload.mimetype, safeFileName)
    const uploadKey = createUploadKey(env, jobId, safeFileName)

    await uploadSourceObject({
      s3,
      bucketName: env.s3Bucket,
      key: uploadKey,
      body: uploadBuffer,
      contentType,
    })

    try {
      await createJobWithUpload(pool, {
        jobId,
        uploadId,
        label,
        uploadKey,
        originalName: safeFileName,
        contentType,
        sizeBytes: uploadBuffer.byteLength,
      })
    } catch (error) {
      await deleteObject({
        s3,
        bucketName: env.s3Bucket,
        key: uploadKey,
      })
      throw error
    }

    try {
      await queue.add(
        processUploadJobName,
        {
          jobId,
          uploadId,
        },
        {
          jobId,
        }
      )
    } catch (error) {
      await markJobFailed(
        pool,
        jobId,
        `Queue enqueue failed: ${getErrorMessage(error)}`
      )
      throw error
    }

    const job = await getJobById(pool, jobId)

    if (!job) {
      throw new Error("The job was created but could not be reloaded.")
    }

    return reply.status(201).send(
      CreateJobResponseSchema.parse({
        job,
      })
    )
  })

  if (existsSync(path.join(clientAssetsRoot, "index.html"))) {
    await app.register(fastifyStatic, {
      root: clientAssetsRoot,
      prefix: "/",
    })

    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api")) {
        return reply.sendFile("index.html")
      }

      return reply.status(404).send({
        error: "Route not found.",
      })
    })
  } else {
    app.setNotFoundHandler((_request, reply) => {
      return reply.status(404).send({
        error: "Route not found.",
      })
    })
  }

  return app
}
