import { Effect } from "effect"
import type { Pool } from "pg"
import type { IdempotencyGuard } from "../domain/port/repository.js"
import { RepositoryError } from "../domain/port/repository.js"

// ─── Postgres Idempotency Guard ────────────────────────────────────────────

export type PgIdempotencyGuard = IdempotencyGuard

export const makePgIdempotencyGuard = (pool: Pool): PgIdempotencyGuard => ({
  check: (key) =>
    Effect.tryPromise({
      try: async () => {
        const result = await pool.query<{ response: unknown }>(
          `SELECT response FROM holon_b.idempotency_keys WHERE key = $1`,
          [key],
        )
        const row = result.rows[0]
        return { exists: !!row, response: row?.response ?? null }
      },
      catch: (cause) => new RepositoryError("IdempotencyGuard.check", cause),
    }),

  save: (key, response) =>
    Effect.tryPromise({
      try: () =>
        pool
          .query(
            `INSERT INTO holon_b.idempotency_keys (key, response) VALUES ($1, $2)
           ON CONFLICT (key) DO NOTHING`,
            [key, JSON.stringify(response)],
          )
          .then(() => undefined),
      catch: (cause) => new RepositoryError("IdempotencyGuard.save", cause),
    }),
})
