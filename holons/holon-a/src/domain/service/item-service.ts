import { Effect } from "effect"
import type { HolonAId, CorrelationId } from "@holonomic/shared/types"
import type { Item } from "../model/item.js"
import { ItemName, ItemDescription } from "../model/item.js"
import {
  ItemRepository,
  EventStore,
  IdempotencyGuard,
  ItemNotFound,
  IdempotencyKeyExists,
  type ItemError,
} from "../port/repository.js"
import { itemCreated, itemUpdated, itemDeleted, itemCompensated } from "../event/item-events.js"

// ─── Domain Service ─────────────────────────────────────────────────────────

export const createItem = (
  id: HolonAId,
  rawName: string,
  rawDescription: string,
  correlationId: CorrelationId,
  idempotencyKey: string | null,
): Effect.Effect<Item, ItemError, ItemRepository | EventStore | IdempotencyGuard> =>
  Effect.gen(function* () {
    const repo = yield* ItemRepository
    const events = yield* EventStore
    const idempotency = yield* IdempotencyGuard

    if (idempotencyKey) {
      const existing = yield* idempotency.check(idempotencyKey)
      if (existing.exists) {
        return yield* Effect.fail(new IdempotencyKeyExists(idempotencyKey, existing.response))
      }
    }

    const name = ItemName(rawName)
    const description = ItemDescription(rawDescription)

    const item: Item = {
      id,
      name,
      description,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    yield* repo.save(item)

    const event = itemCreated(id, name, description, correlationId, 1)
    yield* events.append(id, event)

    if (idempotencyKey) {
      yield* idempotency.save(idempotencyKey, { itemId: id })
    }

    return item
  })

export const getItem = (
  id: HolonAId,
): Effect.Effect<Item, ItemNotFound, ItemRepository> =>
  Effect.gen(function* () {
    const repo = yield* ItemRepository
    return yield* repo.find(id)
  })

export const updateItem = (
  id: HolonAId,
  rawName: string,
  rawDescription: string,
  correlationId: CorrelationId,
): Effect.Effect<Item, ItemError, ItemRepository | EventStore> =>
  Effect.gen(function* () {
    const repo = yield* ItemRepository
    const events = yield* EventStore

    const existing = yield* repo.find(id)
    if (existing.status === "deleted") {
      return yield* Effect.fail(new ItemNotFound(id))
    }

    const name = ItemName(rawName)
    const description = ItemDescription(rawDescription)

    const updated: Item = {
      ...existing,
      name,
      description,
      updatedAt: new Date(),
    }

    yield* repo.update(updated)

    const existingEvents = yield* events.getEvents(id)
    const nextVersion = existingEvents.length + 1
    const event = itemUpdated(id, name, description, correlationId, nextVersion)
    yield* events.append(id, event)

    return updated
  })

export const deleteItem = (
  id: HolonAId,
  correlationId: CorrelationId,
): Effect.Effect<void, ItemError, ItemRepository | EventStore> =>
  Effect.gen(function* () {
    const repo = yield* ItemRepository
    const events = yield* EventStore

    yield* repo.find(id)
    yield* repo.remove(id)

    const existingEvents = yield* events.getEvents(id)
    const nextVersion = existingEvents.length + 1
    const event = itemDeleted(id, correlationId, nextVersion)
    yield* events.append(id, event)
  })

export const compensateItem = (
  id: HolonAId,
  reason: string,
  correlationId: CorrelationId,
): Effect.Effect<void, ItemError, ItemRepository | EventStore> =>
  Effect.gen(function* () {
    const repo = yield* ItemRepository
    const events = yield* EventStore

    yield* repo.remove(id).pipe(
      Effect.catchTag("ItemNotFound", () => Effect.void),
    )

    const existingEvents = yield* events.getEvents(id)
    const nextVersion = existingEvents.length + 1
    const event = itemCompensated(id, reason, correlationId, nextVersion)
    yield* events.append(id, event)
  })
