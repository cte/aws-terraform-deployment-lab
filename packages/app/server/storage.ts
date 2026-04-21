import { createHash } from "node:crypto"
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { lookup } from "mime-types"
import { JobSummarySchema, type JobSummary } from "@shared/contracts.ts"
import type { AppEnv } from "./env.ts"

export function createS3Client(env: AppEnv) {
  return new S3Client({
    region: env.awsRegion,
  })
}

export function sanitizeFileName(fileName: string) {
  const normalized = fileName.trim().replaceAll(/[^a-zA-Z0-9._-]+/g, "-")
  return normalized.length > 0 ? normalized : "upload.txt"
}

export function inferContentType(
  contentType: string | undefined,
  fileName: string
) {
  if (contentType && contentType.trim().length > 0) {
    return contentType
  }

  const inferred = lookup(fileName)
  return typeof inferred === "string" ? inferred : "application/octet-stream"
}

export function createUploadKey(env: AppEnv, jobId: string, fileName: string) {
  return `${env.appConfig.uploadPrefix}/${jobId}/${sanitizeFileName(fileName)}`
}

export function createResultKey(env: AppEnv, jobId: string) {
  return `${env.appConfig.resultPrefix}/${jobId}/summary.json`
}

export async function uploadSourceObject(params: {
  s3: S3Client
  bucketName: string
  key: string
  body: Buffer
  contentType: string
}) {
  await params.s3.send(
    new PutObjectCommand({
      Bucket: params.bucketName,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    })
  )
}

export async function deleteObject(params: {
  s3: S3Client
  bucketName: string
  key: string
}) {
  await params.s3.send(
    new DeleteObjectCommand({
      Bucket: params.bucketName,
      Key: params.key,
    })
  )
}

export async function readObjectBuffer(params: {
  s3: S3Client
  bucketName: string
  key: string
}) {
  const response = await params.s3.send(
    new GetObjectCommand({
      Bucket: params.bucketName,
      Key: params.key,
    })
  )

  if (!response.Body) {
    throw new Error(`S3 object ${params.key} had no response body.`)
  }

  const bytes = await response.Body.transformToByteArray()
  return Buffer.from(bytes)
}

export async function writeSummaryObject(params: {
  s3: S3Client
  bucketName: string
  key: string
  summary: JobSummary
}) {
  await params.s3.send(
    new PutObjectCommand({
      Bucket: params.bucketName,
      Key: params.key,
      Body: JSON.stringify(params.summary, null, 2),
      ContentType: "application/json",
    })
  )
}

function countLines(text: string) {
  if (text.length === 0) {
    return 0
  }

  return text
    .split(/\r?\n/)
    .filter(
      (line, index, lines) => !(index === lines.length - 1 && line === "")
    ).length
}

export function buildSummary(buffer: Buffer, contentType: string) {
  const text = buffer.toString("utf8")
  const previewLines = text
    .split(/\r?\n/)
    .filter(
      (line, index, lines) => !(index === lines.length - 1 && line === "")
    )
    .slice(0, 5)
  const wordCount =
    text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length

  return JobSummarySchema.parse({
    byteCount: buffer.byteLength,
    lineCount: countLines(text),
    wordCount,
    checksumSha256: createHash("sha256").update(buffer).digest("hex"),
    contentType,
    previewLines,
    processedAt: new Date().toISOString(),
  })
}
