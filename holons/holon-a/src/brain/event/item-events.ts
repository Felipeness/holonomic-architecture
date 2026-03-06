import { Effect } from "effect"
import type {
  DomainEvent,
  EventMetadata,
  HolonAId,
  CorrelationId,
  EventId,
} from "@holonomic/shared/types"
import type {
  ItemCreatedPayload,
  ItemUpdatedPayload,
  ItemDeletedPayload,
  ItemCompensatedPayload,
  ItemCreated,
  ItemUpdated,
  ItemDeleted,
  ItemCompensated,
} from "@holonomic/shared/events/holon-a.events"
import type { ItemName, ItemDescription } from "../model/item.js"

const makeMetadata = (correlationId: CorrelationId, version: number): EventMetadata => ({
  eventId: Effect.runSync(Effect.sync(() => crypto.randomUUID())) as EventId,
  correlationId,
  timestamp: new Date(),
  version,
})

export const itemCreated = (
  itemId: HolonAId,
  name: ItemName,
  description: ItemDescription,
  correlationId: CorrelationId,
  version: number,
): ItemCreated => ({
  _tag: "ItemCreated",
  metadata: makeMetadata(correlationId, version),
  payload: { itemId, name, description },
})

export const itemUpdated = (
  itemId: HolonAId,
  name: ItemName,
  description: ItemDescription,
  correlationId: CorrelationId,
  version: number,
): ItemUpdated => ({
  _tag: "ItemUpdated",
  metadata: makeMetadata(correlationId, version),
  payload: { itemId, name, description },
})

export const itemDeleted = (
  itemId: HolonAId,
  correlationId: CorrelationId,
  version: number,
): ItemDeleted => ({
  _tag: "ItemDeleted",
  metadata: makeMetadata(correlationId, version),
  payload: { itemId },
})

export const itemCompensated = (
  itemId: HolonAId,
  reason: string,
  correlationId: CorrelationId,
  version: number,
): ItemCompensated => ({
  _tag: "ItemCompensated",
  metadata: makeMetadata(correlationId, version),
  payload: { itemId, reason },
})
