import { NativeConnection, Worker } from "@temporalio/worker"
import { Pool } from "pg"
import pino from "pino"
import { makeActivities } from "./skin/temporal/activities.js"
import { makePgTaskRepository } from "./memory/repository/task-repository.js"
import { makePgEventStore } from "./memory/event-store/event-store.js"
import { makePgIdempotencyGuard } from "./immune/idempotency.js"

// ─── Config ────────────────────────────────────────────────────────────────

const temporalAddress = process.env["TEMPORAL_ADDRESS"] ?? "localhost:7233"
const taskQueue = process.env["TEMPORAL_TASK_QUEUE_HOLON_B"] ?? "holon-b-queue"

const pool = new Pool({
  host: process.env["POSTGRES_HOST"] ?? "localhost",
  port: parseInt(process.env["POSTGRES_PORT"] ?? "5432", 10),
  user: process.env["POSTGRES_USER"] ?? "holonomic",
  password: process.env["POSTGRES_PASSWORD"] ?? "holonomic_secret",
  database: process.env["POSTGRES_DB"] ?? "holonomic",
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
})

const logger = pino({
  name: "holon-b-worker",
  level: process.env["LOG_LEVEL"] ?? "info",
})

// ─── Infrastructure ────────────────────────────────────────────────────────

const taskRepository = makePgTaskRepository(pool)
const eventStore = makePgEventStore(pool)
const idempotencyGuard = makePgIdempotencyGuard(pool)

// ─── Worker Bootstrap ──────────────────────────────────────────────────────

const run = async () => {
  const connection = await NativeConnection.connect({ address: temporalAddress })

  const activities = makeActivities(taskRepository, eventStore, idempotencyGuard, logger)

  const worker = await Worker.create({
    connection,
    namespace: "default",
    taskQueue,
    activities,
  })

  logger.info({ taskQueue, temporalAddress }, "holon-b temporal worker started")
  await worker.run()
}

const shutdown = async () => {
  logger.info("holon-b worker shutting down")
  await pool.end()
  process.exit(0)
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

run().catch((err) => {
  logger.fatal({ err }, "holon-b worker failed")
  process.exit(1)
})
