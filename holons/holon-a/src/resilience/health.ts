import type { FastifyInstance } from "fastify"
import type { Pool } from "pg"
import type { Redis } from "ioredis"

export const registerHealthRoutes = (app: FastifyInstance, pool: Pool, redis: Redis): void => {
  app.get("/health/live", async (_req, reply) => {
    return reply.status(200).send({ status: "alive" })
  })

  app.get("/health/ready", async (_req, reply) => {
    const checks: Record<string, string> = {}

    try {
      await pool.query("SELECT 1")
      checks["postgres"] = "ok"
    } catch {
      checks["postgres"] = "unreachable"
    }

    try {
      await redis.ping()
      checks["redis"] = "ok"
    } catch {
      checks["redis"] = "unreachable"
    }

    const allOk = Object.values(checks).every((v) => v === "ok")
    return reply.status(allOk ? 200 : 503).send({ status: allOk ? "ready" : "degraded", checks })
  })
}
