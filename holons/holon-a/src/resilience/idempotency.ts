import { Effect, Layer } from "effect"
import type { Pool } from "pg"
import type Redis from "ioredis"
import { IdempotencyGuard, type IdempotencyGuardService } from "../domain/port/repository.js"

const REDIS_TTL_SECONDS = 86_400 // 24h

const makeService = (redis: Redis, pool: Pool): IdempotencyGuardService => ({
  check: (key) =>
    Effect.tryPromise({
      try: async () => {
        const cached = await redis.get(`idempotency:${key}`)
        if (cached) {
          return { exists: true, response: JSON.parse(cached) }
        }

        const result = await pool.query(
          "SELECT response FROM holon_a.idempotency_keys WHERE key = $1",
          [key],
        )
        if (result.rows.length > 0) {
          const row = result.rows[0] as Record<string, unknown>
          const response = row["response"]
          await redis.setex(`idempotency:${key}`, REDIS_TTL_SECONDS, JSON.stringify(response))
          return { exists: true, response }
        }

        return { exists: false, response: null }
      },
      catch: () => ({ exists: false, response: null }),
    }),

  save: (key, response) =>
    Effect.tryPromise({
      try: async () => {
        await pool.query(
          "INSERT INTO holon_a.idempotency_keys (key, response) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
          [key, JSON.stringify(response)],
        )
        await redis.setex(`idempotency:${key}`, REDIS_TTL_SECONDS, JSON.stringify(response))
      },
      catch: () => undefined,
    }).pipe(Effect.asVoid),
})

export const makeIdempotencyGuardLayer = (redis: Redis, pool: Pool): Layer.Layer<IdempotencyGuard> =>
  Layer.succeed(IdempotencyGuard, makeService(redis, pool))
