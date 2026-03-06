import { Brand } from "effect"
import type { HolonAId } from "@holonomic/shared/types"

// ─── Value Objects ──────────────────────────────────────────────────────────

export type ItemName = string & Brand.Brand<"ItemName">
export const ItemName = Brand.refined<ItemName>(
  (s) => s.length > 0 && s.length <= 255,
  (s) => Brand.error(`ItemName must be 1-255 chars, got ${s.length}`),
)

export type ItemDescription = string & Brand.Brand<"ItemDescription">
export const ItemDescription = Brand.refined<ItemDescription>(
  (s) => s.length <= 10_000,
  (s) => Brand.error(`ItemDescription must be <= 10000 chars, got ${s.length}`),
)

// ─── Domain Entity (Discriminated Union by status) ──────────────────────────

interface ItemBase {
  readonly id: HolonAId
  readonly name: ItemName
  readonly description: ItemDescription
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface ActiveItem extends ItemBase {
  readonly status: "active"
}

export interface DeletedItem extends ItemBase {
  readonly status: "deleted"
}

export type Item = ActiveItem | DeletedItem
