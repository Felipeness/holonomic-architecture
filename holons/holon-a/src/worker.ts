import { NativeConnection, Worker } from "@temporalio/worker"
import pg from "pg"
import Redis from "ioredis"
import pino from "pino"
import { Effect } from "effect"
import { makeItemRepositoryLayer } from "./memory/repository/item-repository.js"
import { makeEventStoreLayer } from "./memory/event-store/event-store.js"
import { makeIdempotencyGuardLayer } from "./immune/idempotency.js"
import { ItemRepository, EventStore, IdempotencyGuard } from "./brain/port/repository.js"
import { initActivityDeps, createItemActivity, compensateItemActivity } from "./skin/temporal/activities.js"

// ─── Env ────────────────────────────────────────────────────────────────────

const TEMPORAL_ADDRESS = process.env["TEMPORAL_ADDRESS"] ?? "localhost:7233"
const TEMPORAL_NAMESPACE = process.env["TEMPORAL_NAMESPACE"] ?? "default"
const TASK_QUEUE = process.env["TEMPORAL_TASK_QUEUE_HOLON_A"] ?? "holon-a-queue"
const PG_HOST = process.env["POSTGRES_HOST"] ?? "localhost"
const PG_PORT = parseInt(process.env["POSTGRES_PORT"] ?? "5432", 10)
const PG_USER = process.env["POSTGRES_USER"] ?? "holonomic"
const PG_PASSWORD = process.env["POSTGRES_PASSWORD"] ?? "holonomic_secret"
const PG_DB = process.env["POSTGRES_DB"] ?? "holonomic"
const REDIS_HOST = process.env["REDIS_HOST"] ?? "localhost"
const REDIS_PORT = parseInt(process.env["REDIS_PORT"] ?? "6379", 10)

// ─── Bootstrap ──────────────────────────────────────────────────────────────

const logger = pino({ name: "holon-a-worker", level: "info" })

const run = async (): Promise<void> => {
  const pool = new pg.Pool({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: PG_DB,
    max: 10,
    connectionTimeoutMillis: 5_000,
  })

  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  })

  await redis.connect()
  await pool.query("SELECT 1")

  // Resolve Effect services for activity injection
  const repoLayer = makeItemRepositoryLayer(pool)
  const eventStoreLayer = makeEventStoreLayer(pool)
  const idempotencyLayer = makeIdempotencyGuardLayer(redis, pool)

  const repoService = Effect.runSync(Effect.provide(ItemRepository, repoLayer))
  const eventStoreService = Effect.runSync(Effect.provide(EventStore, eventStoreLayer))
  const idempotencyService = Effect.runSync(Effect.provide(IdempotencyGuard, idempotencyLayer))

  initActivityDeps(repoService, eventStoreService, idempotencyService)

  const connection = await NativeConnection.connect({ address: TEMPORAL_ADDRESS })

  const worker = await Worker.create({
    connection,
    namespace: TEMPORAL_NAMESPACE,
    taskQueue: TASK_QUEUE,
    activities: { createItemActivity, compensateItemActivity },
  })

  logger.info({ taskQueue: TASK_QUEUE, address: TEMPORAL_ADDRESS }, "holon-a worker started")

  const shutdown = async (): Promise<void> => {
    logger.info("worker shutting down")
    worker.shutdown()
    await pool.end()
    redis.disconnect()
  }

  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)

  await worker.run()
}

run().catch((err) => {
  logger.fatal({ err }, "worker failed")
  process.exit(1)
})
