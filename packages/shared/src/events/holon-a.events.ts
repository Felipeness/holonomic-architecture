import type { DomainEvent, HolonAId } from "../types/index.js"

// ─── Holon A Domain Events (Items) ────────────────────────────────────────

export interface ItemCreatedPayload {
  readonly itemId: HolonAId
  readonly name: string
  readonly description: string
}

export interface ItemUpdatedPayload {
  readonly itemId: HolonAId
  readonly name: string
  readonly description: string
}

export interface ItemDeletedPayload {
  readonly itemId: HolonAId
}

export interface ItemCompensatedPayload {
  readonly itemId: HolonAId
  readonly reason: string
}

export type ItemCreated = DomainEvent<"ItemCreated", ItemCreatedPayload>
export type ItemUpdated = DomainEvent<"ItemUpdated", ItemUpdatedPayload>
export type ItemDeleted = DomainEvent<"ItemDeleted", ItemDeletedPayload>
export type ItemCompensated = DomainEvent<"ItemCompensated", ItemCompensatedPayload>

export type HolonAEvent = ItemCreated | ItemUpdated | ItemDeleted | ItemCompensated
