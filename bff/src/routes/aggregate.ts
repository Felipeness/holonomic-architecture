import type { FastifyInstance } from "fastify"
import { Context, Effect } from "effect"
import { HolonAClient, type HolonAClientError } from "../adapters/holon-a-client.js"
import { HolonBClient, type HolonBClientError } from "../adapters/holon-b-client.js"
import type { TemporalClientAdapter } from "../adapters/temporal-client.js"
import { CorrelationId, HolonAId } from "@holonomic/shared/types"

// ─── Aggregate Routes ─────────────────────────────────────────────────────

interface RouteOptions {
  readonly temporalClient: TemporalClientAdapter
  readonly effectContext: Context.Context<HolonAClient | HolonBClient>
}

export async function aggregateRoutes(
  fastify: FastifyInstance,
  options: RouteOptions,
): Promise<void> {
  const { temporalClient, effectContext } = options

  // GET /aggregate/:itemId/:taskId — combine data from both holons
  fastify.get<{
    Params: { itemId: string; taskId: string }
  }>("/aggregate/:itemId/:taskId", async (request, reply) => {
    const { itemId, taskId } = request.params
    const correlationId = request.correlationId

    const program = Effect.all(
      {
        item: Effect.flatMap(HolonAClient, (client) => client.getItem(itemId, correlationId)),
        task: Effect.flatMap(HolonBClient, (client) => client.getTask(taskId, correlationId)),
      },
      { concurrency: "unbounded" },
    )

    try {
      const result = await Effect.runPromise(program.pipe(Effect.provide(effectContext)))
      return reply.send({
        correlationId,
        item: result.item,
        task: result.task,
      })
    } catch (error) {
      const clientError = error as HolonAClientError | HolonBClientError
      const statusCode = clientError.statusCode ?? 502
      return reply.status(statusCode).send({
        error: "Aggregation failed",
        message: clientError.message,
        correlationId,
      })
    }
  })

  // POST /saga — start cross-holon saga
  fastify.post<{
    Body: {
      itemName: string
      itemDescription: string
      taskTitle: string
      taskAssignee: string
    }
  }>("/saga", async (request, reply) => {
    const correlationId = CorrelationId(request.correlationId)

    const result = await temporalClient.startCrossHolonSaga({
      correlationId,
      itemName: request.body.itemName,
      itemDescription: request.body.itemDescription,
      taskTitle: request.body.taskTitle,
      taskAssignee: request.body.taskAssignee,
    })

    return reply.status(202).send({
      workflowId: result.workflowId,
      runId: result.runId,
      correlationId,
    })
  })

  // POST /sync — start sync workflow
  fastify.post<{
    Body: { sourceItemId: string }
  }>("/sync", async (request, reply) => {
    const correlationId = CorrelationId(request.correlationId)

    const result = await temporalClient.startSyncWorkflow({
      correlationId,
      sourceHolonAId: HolonAId(request.body.sourceItemId),
    })

    return reply.status(202).send({
      workflowId: result.workflowId,
      runId: result.runId,
      correlationId,
    })
  })

  // GET /workflow/:workflowId — check workflow status
  fastify.get<{
    Params: { workflowId: string }
  }>("/workflow/:workflowId", async (request, reply) => {
    try {
      const status = await temporalClient.getWorkflowStatus(request.params.workflowId)
      return reply.send(status)
    } catch {
      return reply.status(404).send({
        error: "Workflow not found",
        workflowId: request.params.workflowId,
      })
    }
  })
}
