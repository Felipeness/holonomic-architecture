import type { FastifyInstance } from "fastify"
import { randomUUID } from "node:crypto"

// ─── Correlation ID Plugin ────────────────────────────────────────────────
// Ensures every request carries a correlation-id for distributed tracing

declare module "fastify" {
  interface FastifyRequest {
    correlationId: string
  }
}

export async function correlationIdPlugin(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.decorateRequest("correlationId", "")

  fastify.addHook("onRequest", async (request, reply) => {
    const correlationId =
      (request.headers["x-correlation-id"] as string | undefined) ??
      randomUUID()

    request.correlationId = correlationId
    reply.header("x-correlation-id", correlationId)
  })
}
