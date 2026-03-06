import type { FastifyInstance } from "fastify"
import * as S from "@effect/schema/Schema"
import { Effect, Layer } from "effect"
import { HolonBId, CorrelationId } from "@holonomic/shared/types"
import { v4 as uuid } from "uuid"
import type { Task } from "../../brain/model/task.js"
import {
  createTask,
  getTask,
  completeTask,
  cancelTask,
  type TaskError,
} from "../../brain/service/task-service.js"
import { TaskRepository, EventStore, IdempotencyGuard } from "../../brain/port/repository.js"
import { CreateTaskSchema, CompleteTaskSchema, TaskIdParamsSchema } from "./schemas.js"
import type { PgTaskRepository } from "../../memory/repository/task-repository.js"
import type { PgEventStore } from "../../memory/event-store/event-store.js"
import type { PgIdempotencyGuard } from "../../immune/idempotency.js"
import type { Logger } from "pino"

// ─── Helpers ───────────────────────────────────────────────────────────────

const taskToResponse = (task: Task) => ({
  id: task.id,
  title: task.title,
  assignee: task.assignee,
  status: task._status,
  completedAt: task.completedAt?.toISOString() ?? null,
  createdAt: task.createdAt.toISOString(),
  updatedAt: task.updatedAt.toISOString(),
})

const errorToStatus = (error: TaskError): { status: number; body: { error: string; message: string } } => {
  switch (error._tag) {
    case "TaskNotFound":
      return { status: 404, body: { error: "TaskNotFound", message: `Task ${error.taskId} not found` } }
    case "TaskAlreadyCompleted":
      return { status: 409, body: { error: "TaskAlreadyCompleted", message: `Task ${error.taskId} already completed` } }
    case "TaskAlreadyCancelled":
      return { status: 409, body: { error: "TaskAlreadyCancelled", message: `Task ${error.taskId} already cancelled` } }
    case "InvalidTaskInput":
      return { status: 400, body: { error: "InvalidTaskInput", message: error.message } }
    case "RepositoryError":
      return { status: 500, body: { error: "RepositoryError", message: `${error.operation}: internal error` } }
  }
}

const extractCorrelationId = (headers: Record<string, string | string[] | undefined>): CorrelationId => {
  const raw = headers["x-correlation-id"]
  const value = Array.isArray(raw) ? raw[0] : raw
  return CorrelationId(value ?? uuid())
}

// ─── Route Registration ────────────────────────────────────────────────────

export const registerRoutes = (
  app: FastifyInstance,
  repo: PgTaskRepository,
  eventStore: PgEventStore,
  idempotencyGuard: PgIdempotencyGuard,
  logger: Logger,
) => {
  const serviceLayer = Layer.mergeAll(
    Layer.succeed(TaskRepository, repo),
    Layer.succeed(EventStore, eventStore),
    Layer.succeed(IdempotencyGuard, idempotencyGuard),
  )

  const runEffect = <A, E extends TaskError>(
    effect: Effect.Effect<A, E, TaskRepository | EventStore | IdempotencyGuard>,
  ) => Effect.runPromise(Effect.provide(effect, serviceLayer))

  // POST /tasks
  app.post("/tasks", async (request, reply) => {
    const parsed = S.decodeUnknownEither(CreateTaskSchema)(request.body)
    if (parsed._tag === "Left") {
      return reply.status(400).send({ error: "ValidationError", message: "Invalid request body" })
    }

    const correlationId = extractCorrelationId(request.headers as Record<string, string | string[] | undefined>)
    const idempotencyKey = (request.headers as Record<string, string | undefined>)["x-idempotency-key"]

    try {
      const task = await runEffect(
        createTask(parsed.right.title, parsed.right.assignee, correlationId, idempotencyKey),
      )
      logger.info({ taskId: task.id, correlationId }, "task created")
      return reply.status(201).send(taskToResponse(task))
    } catch (error) {
      const mapped = errorToStatus(error as TaskError)
      logger.error({ error, correlationId }, "create task failed")
      return reply.status(mapped.status).send(mapped.body)
    }
  })

  // GET /tasks/:id
  app.get<{ Params: { id: string } }>("/tasks/:id", async (request, reply) => {
    const paramsParsed = S.decodeUnknownEither(TaskIdParamsSchema)(request.params)
    if (paramsParsed._tag === "Left") {
      return reply.status(400).send({ error: "ValidationError", message: "Invalid task ID" })
    }

    try {
      const taskId = HolonBId(paramsParsed.right.id)
      const task = await runEffect(getTask(taskId))
      return reply.status(200).send(taskToResponse(task))
    } catch (error) {
      const mapped = errorToStatus(error as TaskError)
      return reply.status(mapped.status).send(mapped.body)
    }
  })

  // POST /tasks/:id/complete
  app.post<{ Params: { id: string } }>("/tasks/:id/complete", async (request, reply) => {
    const paramsParsed = S.decodeUnknownEither(TaskIdParamsSchema)(request.params)
    if (paramsParsed._tag === "Left") {
      return reply.status(400).send({ error: "ValidationError", message: "Invalid task ID" })
    }

    S.decodeUnknownEither(CompleteTaskSchema)(request.body ?? {})

    const correlationId = extractCorrelationId(request.headers as Record<string, string | string[] | undefined>)

    try {
      const taskId = HolonBId(paramsParsed.right.id)
      const task = await runEffect(completeTask(taskId, correlationId))
      logger.info({ taskId, correlationId }, "task completed")
      return reply.status(200).send(taskToResponse(task))
    } catch (error) {
      const mapped = errorToStatus(error as TaskError)
      logger.error({ error, correlationId }, "complete task failed")
      return reply.status(mapped.status).send(mapped.body)
    }
  })

  // DELETE /tasks/:id
  app.delete<{ Params: { id: string } }>("/tasks/:id", async (request, reply) => {
    const paramsParsed = S.decodeUnknownEither(TaskIdParamsSchema)(request.params)
    if (paramsParsed._tag === "Left") {
      return reply.status(400).send({ error: "ValidationError", message: "Invalid task ID" })
    }

    const correlationId = extractCorrelationId(request.headers as Record<string, string | string[] | undefined>)

    try {
      const taskId = HolonBId(paramsParsed.right.id)
      await runEffect(cancelTask(taskId, correlationId))
      logger.info({ taskId, correlationId }, "task cancelled")
      return reply.status(204).send()
    } catch (error) {
      const mapped = errorToStatus(error as TaskError)
      logger.error({ error, correlationId }, "cancel task failed")
      return reply.status(mapped.status).send(mapped.body)
    }
  })
}
