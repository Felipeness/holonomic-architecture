import { Effect, Layer } from "effect"
import { HolonBId, CorrelationId } from "@holonomic/shared/types"
import type {
  CreateTaskInput,
  CreateTaskOutput,
  CompensateTaskInput,
} from "@holonomic/shared/workflows"
import { createTask, compensateTask } from "../../domain/service/task-service.js"
import { TaskRepository, EventStore, IdempotencyGuard } from "../../domain/port/repository.js"
import type { PgTaskRepository } from "../../infra/repository/task-repository.js"
import type { PgEventStore } from "../../infra/event-store/event-store.js"
import type { PgIdempotencyGuard } from "../../resilience/idempotency.js"
import type { Logger } from "pino"

// ─── Activity Factory ──────────────────────────────────────────────────────
// Creates Temporal activities wired to real infrastructure via Effect DI

export const makeActivities = (
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

  return {
    createTaskActivity: async (input: CreateTaskInput): Promise<CreateTaskOutput> => {
      logger.info({ input }, "executing createTaskActivity")
      const task = await Effect.runPromise(
        Effect.provide(
          createTask(input.title, input.assignee, input.correlationId),
          serviceLayer,
        ),
      )
      logger.info({ taskId: task.id }, "createTaskActivity completed")
      return { taskId: task.id }
    },

    compensateTaskActivity: async (input: CompensateTaskInput): Promise<void> => {
      logger.info({ input }, "executing compensateTaskActivity")
      await Effect.runPromise(
        Effect.provide(
          compensateTask(input.taskId, input.reason, input.correlationId),
          serviceLayer,
        ),
      )
      logger.info({ taskId: input.taskId }, "compensateTaskActivity completed")
    },
  }
}
