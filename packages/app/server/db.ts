import pg from "pg"
import type { AppEnv } from "./env.ts"

const { Pool } = pg

export function createPool(env: AppEnv) {
  return new Pool({
    host: env.dbHost,
    port: env.dbPort,
    database: env.dbName,
    user: env.dbUser,
    password: env.dbPassword,
    ssl: env.dbSslEnabled
      ? {
          rejectUnauthorized: false,
        }
      : false,
    max: 10,
    idleTimeoutMillis: 30_000,
    allowExitOnIdle: false,
  })
}
