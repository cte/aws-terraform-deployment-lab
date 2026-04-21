import { existsSync } from "node:fs"
import dotenv from "dotenv"
import { z } from "zod"

if (existsSync(".env")) {
  dotenv.config({ quiet: true })
}

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()

    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true
    }

    if (["0", "false", "no", "off"].includes(normalized)) {
      return false
    }
  }

  return value
}, z.boolean())

const AppConfigSchema = z.object({
  queueName: z.string().trim().min(1).default("ember-migration-jobs"),
  uploadPrefix: z.string().trim().min(1).default("uploads"),
  resultPrefix: z.string().trim().min(1).default("results"),
  maxUploadBytes: z.coerce
    .number()
    .int()
    .positive()
    .max(10_000_000)
    .default(2_000_000),
})

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().trim().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  APP_NAME: z.string().trim().min(1).default("Ember Migration Lab"),
  APP_ENVIRONMENT: z.string().trim().min(1).default("test"),
  AWS_REGION: z.string().trim().min(1).default("us-east-1"),
  S3_BUCKET: z.string().trim().min(1),
  DB_HOST: z.string().trim().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().trim().min(1),
  DB_USER: z.string().trim().min(1).default("appuser"),
  DB_PASSWORD: z.string().min(1),
  DB_SSL_ENABLED: booleanFromEnv.default(false),
  REDIS_HOST: z.string().trim().min(1),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_TLS_ENABLED: booleanFromEnv.default(true),
  APP_CONFIG: z.string().default("{}"),
})

export type AppEnv = {
  nodeEnv: z.infer<typeof EnvSchema>["NODE_ENV"]
  host: string
  port: number
  logLevel: z.infer<typeof EnvSchema>["LOG_LEVEL"]
  appName: string
  appEnvironment: string
  awsRegion: string
  s3Bucket: string
  dbHost: string
  dbPort: number
  dbName: string
  dbUser: string
  dbPassword: string
  dbSslEnabled: boolean
  redisHost: string
  redisPort: number
  redisTlsEnabled: boolean
  appConfig: z.infer<typeof AppConfigSchema>
}

let cachedEnv: AppEnv | null = null

export function loadEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv
  }

  const rawEnv = EnvSchema.parse(process.env)
  let appConfig: z.infer<typeof AppConfigSchema>

  try {
    appConfig = AppConfigSchema.parse(JSON.parse(rawEnv.APP_CONFIG))
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown APP_CONFIG error"
    throw new Error(`APP_CONFIG must be valid JSON. ${message}`)
  }

  cachedEnv = {
    nodeEnv: rawEnv.NODE_ENV,
    host: rawEnv.HOST,
    port: rawEnv.PORT,
    logLevel: rawEnv.LOG_LEVEL,
    appName: rawEnv.APP_NAME,
    appEnvironment: rawEnv.APP_ENVIRONMENT,
    awsRegion: rawEnv.AWS_REGION,
    s3Bucket: rawEnv.S3_BUCKET,
    dbHost: rawEnv.DB_HOST,
    dbPort: rawEnv.DB_PORT,
    dbName: rawEnv.DB_NAME,
    dbUser: rawEnv.DB_USER,
    dbPassword: rawEnv.DB_PASSWORD,
    dbSslEnabled: rawEnv.DB_SSL_ENABLED,
    redisHost: rawEnv.REDIS_HOST,
    redisPort: rawEnv.REDIS_PORT,
    redisTlsEnabled: rawEnv.REDIS_TLS_ENABLED,
    appConfig,
  }

  return cachedEnv
}
