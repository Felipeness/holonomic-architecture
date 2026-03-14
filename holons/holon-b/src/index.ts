import Fastify from "fastify"
import { Pool } from "pg"
import { Redis } from "ioredis"
import pino from "pino"
import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http"
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http"
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify"
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { registerRoutes } from "./api/http/routes.js"
import { registerHealthRoutes } from "./resilience/health.js"
import { makePgTaskRepository } from "./infra/repository/task-repository.js"
import { makePgEventStore } from "./infra/event-store/event-store.js"
import { makePgIdempotencyGuard } from "./resilience/idempotency.js"

// ─── Config ────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env["HOLON_B_PORT"] ?? "3002", 10)
const PG_HOST = process.env["POSTGRES_HOST"] ?? "localhost"
const PG_PORT = parseInt(process.env["POSTGRES_PORT"] ?? "5432", 10)
const PG_USER = process.env["POSTGRES_USER"] ?? "holonomic"
const PG_PASSWORD = process.env["POSTGRES_PASSWORD"] ?? "holonomic_secret"
const PG_DB = process.env["POSTGRES_DB"] ?? "holonomic"
const REDIS_HOST = process.env["REDIS_HOST"] ?? "localhost"
const REDIS_PORT = parseInt(process.env["REDIS_PORT"] ?? "6379", 10)
const OTEL_ENDPOINT = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] ?? "http://localhost:4318"

// ─── OpenTelemetry ─────────────────────────────────────────────────────────

const otelSdk = new NodeSDK({
  serviceName: "holon-b",
  traceExporter: new OTLPTraceExporter({
    url: `${OTEL_ENDPOINT}/v1/traces`,
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${OTEL_ENDPOINT}/v1/metrics`,
    }),
    exportIntervalMillis: 15_000,
  }),
  instrumentations: [new HttpInstrumentation(), new FastifyInstrumentation()],
})

otelSdk.start()

// ─── Infrastructure ────────────────────────────────────────────────────────

const logger = pino({ name: "holon-b", level: "info" })

const pool = new Pool({
  host: PG_HOST,
  port: PG_PORT,
  user: PG_USER,
  password: PG_PASSWORD,
  database: PG_DB,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

// ─── Domain Adapters ───────────────────────────────────────────────────────

const taskRepository = makePgTaskRepository(pool)
const eventStore = makePgEventStore(pool)
const idempotencyGuard = makePgIdempotencyGuard(pool)

// ─── Server ────────────────────────────────────────────────────────────────

const app = Fastify({ logger: false })

registerHealthRoutes(app, pool, redis)
registerRoutes(app, taskRepository, eventStore, idempotencyGuard, logger)

const start = async (): Promise<void> => {
  try {
    await redis.connect()
    await pool.query("SELECT 1")
    logger.info("postgres connected")
    logger.info("redis connected")

    await app.listen({ port: PORT, host: "0.0.0.0" })
    logger.info({ port: PORT }, "holon-b listening")
  } catch (err) {
    logger.fatal({ err }, "startup failed")
    process.exit(1)
  }
}

// ─── Graceful Shutdown ─────────────────────────────────────────────────────

const shutdown = async (): Promise<void> => {
  logger.info("shutting down")
  await app.close()
  await pool.end()
  redis.disconnect()
  await otelSdk.shutdown()
  process.exit(0)
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

start()
