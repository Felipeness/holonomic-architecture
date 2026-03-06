import { Brand } from "effect"

// ─── Branded Types ─────────────────────────────────────────────────────────
// Prevent accidental mixing of IDs across holons (HolonAId ≠ HolonBId)

export type HolonAId = string & Brand.Brand<"HolonAId">
export const HolonAId = Brand.nominal<HolonAId>()

export type HolonBId = string & Brand.Brand<"HolonBId">
export const HolonBId = Brand.nominal<HolonBId>()

export type CorrelationId = string & Brand.Brand<"CorrelationId">
export const CorrelationId = Brand.nominal<CorrelationId>()

export type EventId = string & Brand.Brand<"EventId">
export const EventId = Brand.nominal<EventId>()

// ─── Common Domain Types ───────────────────────────────────────────────────

export interface EventMetadata {
  readonly eventId: EventId
  readonly correlationId: CorrelationId
  readonly timestamp: Date
  readonly version: number
}

export interface DomainEvent<Tag extends string, Payload> {
  readonly _tag: Tag
  readonly metadata: EventMetadata
  readonly payload: Payload
}
