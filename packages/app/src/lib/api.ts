import { z } from "zod"
import {
  AppMetaSchema,
  CreateJobResponseSchema,
  JobResponseSchema,
  JobsResponseSchema,
} from "@shared/contracts.ts"

async function readErrorMessage(response: Response) {
  const fallback = `Request failed with status ${response.status}.`

  try {
    const payload = await response.json()

    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      return payload.error
    }

    if (
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
    ) {
      return payload.message
    }
  } catch {
    return fallback
  }

  return fallback
}

async function requestJson<TSchema extends z.ZodTypeAny>(
  input: RequestInfo | URL,
  schema: TSchema,
  init?: RequestInit
): Promise<z.infer<TSchema>> {
  const response = await fetch(input, init)

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return schema.parse(await response.json())
}

export function getMeta() {
  return requestJson("/api/meta", AppMetaSchema)
}

export function getJobs() {
  return requestJson("/api/jobs", JobsResponseSchema)
}

export function getJob(jobId: string) {
  return requestJson(`/api/jobs/${jobId}`, JobResponseSchema)
}

export function createJob(formData: FormData) {
  return requestJson("/api/jobs", CreateJobResponseSchema, {
    method: "POST",
    body: formData,
  })
}
