import { Context, Effect } from "effect"
import type { HolonAId } from "@holonomic/shared/types"
import type { HolonAEvent } from "@holonomic/shared/events/holon-a.events"
import type { Item } from "../model/item.js"

// ─── Domain Errors ──────────────────────────────────────────────────────────

export class ItemNotFound {
  readonly _tag = "ItemNotFound"
  constructor(readonly itemId: HolonAId) {}
}

export class ItemAlreadyExists {
  readonly _tag = "ItemAlreadyExists"
  constructor(readonly itemId: HolonAId) {}
}

export class ItemRepositoryError {
  readonly _tag = "ItemRepositoryError"
  constructor(readonly cause: unknown) {}
}

export class EventStoreError {
  readonly _tag = "EventStoreError"
  constructor(readonly cause: unknown) {}
}

export class IdempotencyKeyExists {
  readonly _tag = "IdempotencyKeyExists"
  constructor(
    readonly key: string,
    readonly response: unknown,
  ) {}
}

export type ItemError =
  | ItemNotFound
  | ItemAlreadyExists
  | ItemRepositoryError
  | EventStoreError
  | IdempotencyKeyExists

// ─── Ports (Context.Tag for DI) ─────────────────────────────────────────────

export interface ItemRepositoryService {
  readonly find: (id: HolonAId) => Effect.Effect<Item, ItemNotFound | ItemRepositoryError>
  readonly save: (item: Item) => Effect.Effect<void, ItemAlreadyExists | ItemRepositoryError>
  readonly update: (item: Item) => Effect.Effect<void, ItemNotFound | ItemRepositoryError>
  readonly remove: (id: HolonAId) => Effect.Effect<void, ItemNotFound | ItemRepositoryError>
}

export class ItemRepository extends Context.Tag("ItemRepository")<
  ItemRepository,
  ItemRepositoryService
>() {}

export interface EventStoreService {
  readonly append: (
    aggregateId: HolonAId,
    event: HolonAEvent,
  ) => Effect.Effect<void, EventStoreError>
  readonly getEvents: (
    aggregateId: HolonAId,
  ) => Effect.Effect<readonly HolonAEvent[], EventStoreError>
  readonly getSnapshot: (aggregateId: HolonAId) => Effect.Effect<Item | null, EventStoreError>
  readonly saveSnapshot: (
    aggregateId: HolonAId,
    state: Item,
    version: number,
  ) => Effect.Effect<void, EventStoreError>
}

export class EventStore extends Context.Tag("EventStore")<EventStore, EventStoreService>() {}

export interface IdempotencyGuardService {
  readonly check: (key: string) => Effect.Effect<{ exists: boolean; response: unknown | null }>
  readonly save: (key: string, response: unknown) => Effect.Effect<void>
}

export class IdempotencyGuard extends Context.Tag("IdempotencyGuard")<
  IdempotencyGuard,
  IdempotencyGuardService
>() {}
