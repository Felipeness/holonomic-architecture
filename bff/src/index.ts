import Fastify from "fastify"
import { Context } from "effect"
import { Redis } from "ioredis"
import pino from "pino"
import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http"
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http"
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify"
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { correlationIdPlugin } from "./middleware/correlation-id.js"
import { rateLimitPlugin } from "./middleware/rate-limit.js"
import { aggregateRoutes } from "./routes/aggregate.js"
import { HolonAClient, makeHolonAClient } from "./adapters/holon-a-client.js"
import { HolonBClient, makeHolonBClient } from "./adapters/holon-b-client.js"
import { createTemporalClient } from "./adapters/temporal-client.js"

// ─── Configuration ────────────────────────────────────────────────────────

const config = {
  port: Number(process.env.BFF_PORT ?? 3000),
  holonAUrl: process.env.HOLON_A_URL ?? "http://localhost:3001",
  holonBUrl: process.env.HOLON_B_URL ?? "http://localhost:3002",
  temporalAddress: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  temporalTaskQueue: process.env.TEMPORAL_TASK_QUEUE_WORKFLOWS ?? "cross-holon-queue",
  redisHost: process.env.REDIS_HOST ?? "localhost",
  redisPort: Number(process.env.REDIS_PORT ?? 6379),
  otelEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318",
  serviceName: process.env.OTEL_SERVICE_NAME ?? "bff",
}

// ─── Observability ────────────────────────────────────────────────────────

const otelSdk = new NodeSDK({
  serviceName: config.serviceName,
  traceExporter: new OTLPTraceExporter({ url: `${config.otelEndpoint}/v1/traces` }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: `${config.otelEndpoint}/v1/metrics` }),
    exportIntervalMillis: 15_000,
  }),
  instrumentations: [new HttpInstrumentation(), new FastifyInstrumentation()],
})

// ─── Bootstrap ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const logger = pino({ name: config.serviceName })

  // Start OTEL
  otelSdk.start()
  logger.info("OpenTelemetry SDK started")

  // Redis
  const redis = new Redis({
    host: config.redisHost,
    port: config.redisPort,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  })
  await redis.connect()
  logger.info("Redis connected")

  // Temporal client
  const temporalClient = await createTemporalClient(
    config.temporalAddress,
    config.temporalTaskQueue,
  )
  logger.info("Temporal client connected")

  // Effect context for holon clients
  const effectContext = Context.empty().pipe(
    Context.add(HolonAClient, makeHolonAClient(config.holonAUrl)),
    Context.add(HolonBClient, makeHolonBClient(config.holonBUrl)),
  )

  // Fastify server
  const fastify = Fastify({
    logger: {
      level: "info",
      transport: undefined,
    },
  })

  // Plugins
  await fastify.register(correlationIdPlugin)
  await fastify.register(rateLimitPlugin, {
    redis,
    windowMs: 60_000,
    maxRequests: 100,
  })

  // Health check
  fastify.get("/health/live", async () => ({ status: "ok" }))
  fastify.get("/health/ready", async (_request, reply) => {
    try {
      await redis.ping()
      return { status: "ok", redis: "connected" }
    } catch {
      return reply.status(503).send({ status: "degraded", redis: "disconnected" })
    }
  })

  // Routes
  await fastify.register(aggregateRoutes, { temporalClient, effectContext })

  // Start server
  await fastify.listen({ port: config.port, host: "0.0.0.0" })
  logger.info(`BFF listening on port ${config.port}`)

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`)
    await fastify.close()
    await temporalClient.close()
    redis.disconnect()
    await otelSdk.shutdown()
    process.exit(0)
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}

main().catch((error) => {
  console.error("BFF failed to start:", error)
  process.exit(1)
})
