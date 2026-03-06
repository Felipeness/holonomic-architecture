import { Schema } from "@effect/schema"

// ─── Request Schemas ────────────────────────────────────────────────────────

export const CreateItemSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255)),
  description: Schema.String.pipe(Schema.maxLength(10_000)),
})

export const UpdateItemSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255)),
  description: Schema.String.pipe(Schema.maxLength(10_000)),
})

// ─── Response Schemas ───────────────────────────────────────────────────────

export const ItemResponseSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  status: Schema.Union(Schema.Literal("active"), Schema.Literal("deleted")),
  createdAt: Schema.String,
  updatedAt: Schema.String,
})

// ─── Decoded types ──────────────────────────────────────────────────────────

export type CreateItemBody = typeof CreateItemSchema.Type
export type UpdateItemBody = typeof UpdateItemSchema.Type
export type ItemResponse = typeof ItemResponseSchema.Type
