import type { FastifyInstance } from "fastify"
import { Effect, Layer } from "effect"
import { Schema } from "@effect/schema"
import { HolonAId, CorrelationId } from "@holonomic/shared/types"
import { CreateItemSchema, UpdateItemSchema, type ItemResponse } from "./schemas.js"
import * as ItemService from "../../domain/service/item-service.js"
import {
  ItemRepository,
  EventStore,
  IdempotencyGuard,
  type ItemRepositoryService,
  type EventStoreService,
  type IdempotencyGuardService,
} from "../../domain/port/repository.js"
import type { Item } from "../../domain/model/item.js"
import type { Logger } from "pino"

const toResponse = (item: Item): ItemResponse => ({
  id: item.id,
  name: item.name,
  description: item.description,
  status: item.status,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
})

interface RouteDeps {
  readonly repoService: ItemRepositoryService
  readonly eventStoreService: EventStoreService
  readonly idempotencyService: IdempotencyGuardService
  readonly logger: Logger
}

const runEffect = <A, E>(
  effect: Effect.Effect<A, E, ItemRepository | EventStore | IdempotencyGuard>,
  deps: RouteDeps,
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(ItemRepository, deps.repoService),
          Layer.succeed(EventStore, deps.eventStoreService),
          Layer.succeed(IdempotencyGuard, deps.idempotencyService),
        ),
      ),
    ),
  )

export const registerRoutes = (app: FastifyInstance, deps: RouteDeps): void => {
  const decode = <I, A>(schema: Schema.Schema<A, I>, data: unknown): A =>
    Schema.decodeUnknownSync(schema)(data)

  app.post<{ Body: unknown }>("/items", async (req, reply) => {
    const correlationId = CorrelationId(
      (req.headers["x-correlation-id"] as string) ?? crypto.randomUUID(),
    )
    const idempotencyKey = (req.headers["x-idempotency-key"] as string) ?? null

    let body: { name: string; description: string }
    try {
      body = decode(CreateItemSchema, req.body)
    } catch (err) {
      return reply.status(400).send({ error: "Invalid request body", details: String(err) })
    }

    const itemId = HolonAId(crypto.randomUUID())
    deps.logger.info({ correlationId, itemId, op: "createItem" }, "creating item")

    try {
      const item = await runEffect(
        ItemService.createItem(itemId, body.name, body.description, correlationId, idempotencyKey),
        deps,
      )
      return reply.status(201).send(toResponse(item))
    } catch (err: unknown) {
      if (err && typeof err === "object" && "_tag" in err) {
        const tagged = err as { _tag: string; response?: unknown }
        if (tagged._tag === "IdempotencyKeyExists") {
          return reply.status(200).send(tagged.response)
        }
        if (tagged._tag === "ItemAlreadyExists") {
          return reply.status(409).send({ error: "Item already exists" })
        }
      }
      deps.logger.error({ err, correlationId }, "create item failed")
      return reply.status(500).send({ error: "Internal server error" })
    }
  })

  app.get<{ Params: { id: string } }>("/items/:id", async (req, reply) => {
    const itemId = HolonAId(req.params.id)

    try {
      const item = await runEffect(ItemService.getItem(itemId), deps)
      return reply.send(toResponse(item))
    } catch (err: unknown) {
      if (err && typeof err === "object" && "_tag" in err) {
        const tagged = err as { _tag: string }
        if (tagged._tag === "ItemNotFound") {
          return reply.status(404).send({ error: "Item not found" })
        }
      }
      deps.logger.error({ err, itemId }, "get item failed")
      return reply.status(500).send({ error: "Internal server error" })
    }
  })

  app.put<{ Params: { id: string }; Body: unknown }>("/items/:id", async (req, reply) => {
    const correlationId = CorrelationId(
      (req.headers["x-correlation-id"] as string) ?? crypto.randomUUID(),
    )
    const itemId = HolonAId(req.params.id)

    let body: { name: string; description: string }
    try {
      body = decode(UpdateItemSchema, req.body)
    } catch (err) {
      return reply.status(400).send({ error: "Invalid request body", details: String(err) })
    }

    deps.logger.info({ correlationId, itemId, op: "updateItem" }, "updating item")

    try {
      const item = await runEffect(
        ItemService.updateItem(itemId, body.name, body.description, correlationId),
        deps,
      )
      return reply.send(toResponse(item))
    } catch (err: unknown) {
      if (err && typeof err === "object" && "_tag" in err) {
        const tagged = err as { _tag: string }
        if (tagged._tag === "ItemNotFound") {
          return reply.status(404).send({ error: "Item not found" })
        }
      }
      deps.logger.error({ err, correlationId, itemId }, "update item failed")
      return reply.status(500).send({ error: "Internal server error" })
    }
  })

  app.delete<{ Params: { id: string } }>("/items/:id", async (req, reply) => {
    const correlationId = CorrelationId(
      (req.headers["x-correlation-id"] as string) ?? crypto.randomUUID(),
    )
    const itemId = HolonAId(req.params.id)

    deps.logger.info({ correlationId, itemId, op: "deleteItem" }, "deleting item")

    try {
      await runEffect(ItemService.deleteItem(itemId, correlationId), deps)
      return reply.status(204).send()
    } catch (err: unknown) {
      if (err && typeof err === "object" && "_tag" in err) {
        const tagged = err as { _tag: string }
        if (tagged._tag === "ItemNotFound") {
          return reply.status(404).send({ error: "Item not found" })
        }
      }
      deps.logger.error({ err, correlationId, itemId }, "delete item failed")
      return reply.status(500).send({ error: "Internal server error" })
    }
  })
}
