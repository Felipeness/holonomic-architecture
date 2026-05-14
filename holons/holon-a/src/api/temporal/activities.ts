import { Effect, Layer } from "effect"
import { HolonAId } from "@holonomic/shared/types"
import type {
  CreateItemInput,
  CreateItemOutput,
  CompensateItemInput,
} from "@holonomic/shared/workflows"
import * as ItemService from "../../domain/service/item-service.js"
import {
  ItemRepository,
  EventStore,
  IdempotencyGuard,
  type ItemRepositoryService,
  type EventStoreService,
  type IdempotencyGuardService,
} from "../../domain/port/repository.js"

// ─── Activity Context (injected at worker bootstrap) ────────────────────────

let _repoService: ItemRepositoryService
let _eventStoreService: EventStoreService
let _idempotencyService: IdempotencyGuardService

export const initActivityDeps = (
  repo: ItemRepositoryService,
  eventStore: EventStoreService,
  idempotency: IdempotencyGuardService,
): void => {
  _repoService = repo
  _eventStoreService = eventStore
  _idempotencyService = idempotency
}

const makeLayer = () =>
  Layer.mergeAll(
    Layer.succeed(ItemRepository, _repoService),
    Layer.succeed(EventStore, _eventStoreService),
    Layer.succeed(IdempotencyGuard, _idempotencyService),
  )

// ─── Temporal Activities ────────────────────────────────────────────────────

export async function createItemActivity(input: CreateItemInput): Promise<CreateItemOutput> {
  const itemId = HolonAId(crypto.randomUUID())
  const item = await Effect.runPromise(
    ItemService.createItem(itemId, input.name, input.description, input.correlationId, null).pipe(
      Effect.provide(makeLayer()),
    ),
  )
  return { itemId: item.id }
}

export async function compensateItemActivity(input: CompensateItemInput): Promise<void> {
  await Effect.runPromise(
    ItemService.compensateItem(input.itemId, input.reason, input.correlationId).pipe(
      Effect.provide(makeLayer()),
    ),
  )
}
