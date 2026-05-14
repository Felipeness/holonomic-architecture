import type { FastifyInstance } from "fastify"
import type { Redis } from "ioredis"

// ─── Rate Limit Plugin ────────────────────────────────────────────────────
// Simple sliding window rate limiter backed by Redis

interface RateLimitOptions {
  readonly redis: Redis
  readonly windowMs: number
  readonly maxRequests: number
}

export async function rateLimitPlugin(
  fastify: FastifyInstance,
  options: RateLimitOptions,
): Promise<void> {
  const { redis, windowMs, maxRequests } = options
  const windowSeconds = Math.ceil(windowMs / 1_000)

  fastify.addHook("onRequest", async (request, reply) => {
    const ip = request.ip
    const key = `rate-limit:${ip}`

    const current = await redis.incr(key)
    if (current === 1) {
      await redis.expire(key, windowSeconds)
    }

    reply.header("x-ratelimit-limit", maxRequests)
    reply.header("x-ratelimit-remaining", Math.max(0, maxRequests - current))

    if (current > maxRequests) {
      reply.status(429).send({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again in ${windowSeconds}s.`,
      })
    }
  })
}
