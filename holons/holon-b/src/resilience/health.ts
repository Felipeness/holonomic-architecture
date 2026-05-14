import type { FastifyInstance } from "fastify"
import type { Pool } from "pg"
import type { Redis } from "ioredis"

// ─── Health Check Routes ───────────────────────────────────────────────────

export const registerHealthRoutes = (app: FastifyInstance, pool: Pool, redis?: Redis) => {
  app.get("/health/live", async (_request, reply) => {
    return reply.status(200).send({ status: "ok", service: "holon-b" })
  })

  app.get("/health/ready", async (_request, reply) => {
    try {
      await pool.query("SELECT 1")
      if (redis) await redis.ping()
      return reply.status(200).send({
        status: "ready",
        service: "holon-b",
        postgres: "connected",
        redis: redis ? "connected" : "not_configured",
      })
    } catch {
      return reply.status(503).send({ status: "not_ready", service: "holon-b" })
    }
  })
}
