import { buildServer } from "./app.ts"
import { loadEnv } from "./env.ts"

const env = loadEnv()
const app = await buildServer(env)

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down web service.")
  await app.close()
  process.exit(0)
}

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})

try {
  await app.listen({
    host: env.host,
    port: env.port,
  })
  app.log.info(
    {
      host: env.host,
      port: env.port,
    },
    "Web service ready."
  )
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
