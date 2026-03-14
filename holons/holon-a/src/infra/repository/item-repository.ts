import { Effect, Layer } from "effect"
import type { Pool } from "pg"
import { HolonAId } from "@holonomic/shared/types"
import {
  ItemRepository,
  ItemNotFound,
  ItemAlreadyExists,
  ItemRepositoryError,
  type ItemRepositoryService,
} from "../../domain/port/repository.js"
import { ItemName, ItemDescription, type Item } from "../../domain/model/item.js"

const rowToItem = (row: Record<string, unknown>): Item => ({
  id: HolonAId(row["id"] as string),
  name: ItemName(row["name"] as string),
  description: ItemDescription(row["description"] as string),
  status: row["status"] as "active" | "deleted",
  createdAt: new Date(row["created_at"] as string),
  updatedAt: new Date(row["updated_at"] as string),
})

const makeService = (pool: Pool): ItemRepositoryService => ({
  find: (id) =>
    Effect.tryPromise({
      try: () => pool.query("SELECT * FROM holon_a.items WHERE id = $1", [id]),
      catch: (err) => new ItemRepositoryError(err),
    }).pipe(
      Effect.flatMap((result) =>
        result.rows.length === 0
          ? Effect.fail(new ItemNotFound(id))
          : Effect.succeed(rowToItem(result.rows[0] as Record<string, unknown>)),
      ),
    ),

  save: (item) =>
    Effect.tryPromise({
      try: () =>
        pool.query(
          `INSERT INTO holon_a.items (id, name, description, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [item.id, item.name, item.description, item.status, item.createdAt, item.updatedAt],
        ),
      catch: (err) => {
        if (err && typeof err === "object" && "code" in err && err.code === "23505") {
          return new ItemAlreadyExists(item.id)
        }
        return new ItemRepositoryError(err)
      },
    }).pipe(Effect.asVoid),

  update: (item) =>
    Effect.tryPromise({
      try: () =>
        pool.query(
          `UPDATE holon_a.items SET name = $1, description = $2, status = $3, updated_at = $4
           WHERE id = $5`,
          [item.name, item.description, item.status, item.updatedAt, item.id],
        ),
      catch: (err) => new ItemRepositoryError(err),
    }).pipe(
      Effect.flatMap((result) =>
        result.rowCount === 0 ? Effect.fail(new ItemNotFound(item.id)) : Effect.void,
      ),
    ),

  remove: (id) =>
    Effect.tryPromise({
      try: () =>
        pool.query(
          `UPDATE holon_a.items SET status = 'deleted', updated_at = NOW() WHERE id = $1 AND status = 'active'`,
          [id],
        ),
      catch: (err) => new ItemRepositoryError(err),
    }).pipe(
      Effect.flatMap((result) =>
        result.rowCount === 0 ? Effect.fail(new ItemNotFound(id)) : Effect.void,
      ),
    ),
})

export const makeItemRepositoryLayer = (pool: Pool): Layer.Layer<ItemRepository> =>
  Layer.succeed(ItemRepository, makeService(pool))
