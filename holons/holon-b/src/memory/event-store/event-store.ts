import { Effect } from "effect"
import type { Pool } from "pg"
import type { HolonBId } from "@holonomic/shared/types"
import type { HolonBEvent } from "@holonomic/shared/events/holon-b.events"
import type { EventStore } from "../../brain/port/repository.js"
import { RepositoryError } from "../../brain/port/repository.js"

// ─── Postgres Event Store Implementation ───────────────────────────────────

export type PgEventStore = EventStore

export const makePgEventStore = (pool: Pool): PgEventStore => ({
  append: (aggregateId, event) =>
    Effect.tryPromise({
      try: () =>
        pool.query(
          `INSERT INTO holon_b.events (id, aggregate_id, event_type, payload, metadata, version)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            event.metadata.eventId,
            aggregateId,
            event._tag,
            JSON.stringify(event.payload),
            JSON.stringify({
              correlationId: event.metadata.correlationId,
              timestamp: event.metadata.timestamp.toISOString(),
            }),
            event.metadata.version,
          ],
        ).then(() => undefined),
      catch: (cause) => new RepositoryError("EventStore.append", cause),
    }),

  getEvents: (aggregateId) =>
    Effect.tryPromise({
      try: async () => {
        const result = await pool.query<{
          id: string
          event_type: string
          payload: unknown
          metadata: { correlationId: string; timestamp: string }
          version: number
          created_at: Date
        }>(
          `SELECT id, event_type, payload, metadata, version, created_at
           FROM holon_b.events
           WHERE aggregate_id = $1
           ORDER BY version ASC`,
          [aggregateId],
        )
        return result.rows.map((row) => ({
          _tag: row.event_type as HolonBEvent["_tag"],
          metadata: {
            eventId: row.id,
            correlationId: row.metadata.correlationId,
            timestamp: new Date(row.metadata.timestamp),
            version: row.version,
          },
          payload: row.payload,
        })) as unknown as ReadonlyArray<HolonBEvent>
      },
      catch: (cause) => new RepositoryError("EventStore.getEvents", cause),
    }),

  getVersion: (aggregateId: HolonBId) =>
    Effect.tryPromise({
      try: async () => {
        const result = await pool.query<{ max_version: number | null }>(
          `SELECT MAX(version) as max_version FROM holon_b.events WHERE aggregate_id = $1`,
          [aggregateId],
        )
        return result.rows[0]?.max_version ?? 0
      },
      catch: (cause) => new RepositoryError("EventStore.getVersion", cause),
    }),
})
