import { Effect, Layer } from "effect"
import type { Pool } from "pg"
import { HolonAId } from "@holonomic/shared/types"
import type { HolonAEvent } from "@holonomic/shared/events/holon-a.events"
import {
  EventStore,
  EventStoreError,
  type EventStoreService,
} from "../../domain/port/repository.js"
import { ItemName, ItemDescription, type Item } from "../../domain/model/item.js"

const makeService = (pool: Pool): EventStoreService => ({
  append: (aggregateId, event) =>
    Effect.tryPromise({
      try: () =>
        pool.query(
          `INSERT INTO holon_a.events (id, aggregate_id, event_type, payload, metadata, version)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            event.metadata.eventId,
            aggregateId,
            event._tag,
            JSON.stringify(event.payload),
            JSON.stringify(event.metadata),
            event.metadata.version,
          ],
        ),
      catch: (err) => new EventStoreError(err),
    }).pipe(Effect.asVoid),

  getEvents: (aggregateId) =>
    Effect.tryPromise({
      try: () =>
        pool.query(
          `SELECT event_type, payload, metadata, version
           FROM holon_a.events
           WHERE aggregate_id = $1
           ORDER BY version ASC`,
          [aggregateId],
        ),
      catch: (err) => new EventStoreError(err),
    }).pipe(
      Effect.map((result) =>
        result.rows.map((row: Record<string, unknown>) => ({
          _tag: row["event_type"] as HolonAEvent["_tag"],
          payload: row["payload"] as HolonAEvent["payload"],
          metadata: row["metadata"] as HolonAEvent["metadata"],
        })) as unknown as readonly HolonAEvent[],
      ),
    ),

  getSnapshot: (aggregateId) =>
    Effect.tryPromise({
      try: () =>
        pool.query(
          `SELECT state, version FROM holon_a.snapshots WHERE aggregate_id = $1`,
          [aggregateId],
        ),
      catch: (err) => new EventStoreError(err),
    }).pipe(
      Effect.map((result) => {
        if (result.rows.length === 0) return null
        const row = result.rows[0] as Record<string, unknown>
        const state = row["state"] as Record<string, unknown>
        return {
          id: HolonAId(state["id"] as string),
          name: ItemName(state["name"] as string),
          description: ItemDescription(state["description"] as string),
          status: state["status"] as "active" | "deleted",
          createdAt: new Date(state["createdAt"] as string),
          updatedAt: new Date(state["updatedAt"] as string),
        } as Item
      }),
    ),

  saveSnapshot: (aggregateId, state, version) =>
    Effect.tryPromise({
      try: () =>
        pool.query(
          `INSERT INTO holon_a.snapshots (aggregate_id, state, version)
           VALUES ($1, $2, $3)
           ON CONFLICT (aggregate_id) DO UPDATE SET state = $2, version = $3, created_at = NOW()`,
          [aggregateId, JSON.stringify(state), version],
        ),
      catch: (err) => new EventStoreError(err),
    }).pipe(Effect.asVoid),
})

export const makeEventStoreLayer = (pool: Pool): Layer.Layer<EventStore> =>
  Layer.succeed(EventStore, makeService(pool))
