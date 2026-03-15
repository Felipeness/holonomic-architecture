import { Effect } from "effect"
import { v4 as uuid } from "uuid"
import { HolonBId, type CorrelationId } from "@holonomic/shared/types"
import {
  createPendingTask,
  completeTask as completeTaskModel,
  cancelTask as cancelTaskModel,
  TaskTitle,
  TaskAssignee,
  type Task,
} from "../model/task.js"
import {
  TaskRepository,
  EventStore,
  IdempotencyGuard,
  RepositoryError,
} from "../port/repository.js"
import { taskCreated, taskCompleted, taskCancelled, taskCompensated } from "../event/task-events.js"

// ─── Domain Errors ─────────────────────────────────────────────────────────

export class TaskNotFound {
  readonly _tag = "TaskNotFound" as const
  constructor(readonly taskId: string) {}
}

export class TaskAlreadyCompleted {
  readonly _tag = "TaskAlreadyCompleted" as const
  constructor(readonly taskId: string) {}
}

export class TaskAlreadyCancelled {
  readonly _tag = "TaskAlreadyCancelled" as const
  constructor(readonly taskId: string) {}
}

export class InvalidTaskInput {
  readonly _tag = "InvalidTaskInput" as const
  constructor(readonly message: string) {}
}

export type TaskError =
  | TaskNotFound
  | TaskAlreadyCompleted
  | TaskAlreadyCancelled
  | InvalidTaskInput
  | RepositoryError

// ─── Create Task ───────────────────────────────────────────────────────────

export const createTask = (
  title: string,
  assignee: string,
  correlationId: CorrelationId,
  idempotencyKey?: string,
): Effect.Effect<Task, TaskError, TaskRepository | EventStore | IdempotencyGuard> =>
  Effect.gen(function* () {
    const repo = yield* TaskRepository
    const events = yield* EventStore
    const idempotency = yield* IdempotencyGuard

    if (idempotencyKey) {
      const existing = yield* idempotency.check(idempotencyKey)
      if (existing.exists) {
        return existing.response as Task
      }
    }

    let brandedTitle: TaskTitle | null = null
    try {
      brandedTitle = TaskTitle(title)
    } catch {
      brandedTitle = null
    }
    if (!brandedTitle) {
      return yield* Effect.fail(new InvalidTaskInput(`Invalid title: must be 1-255 chars`))
    }

    let brandedAssignee: TaskAssignee | null = null
    try {
      brandedAssignee = TaskAssignee(assignee)
    } catch {
      brandedAssignee = null
    }
    if (!brandedAssignee) {
      return yield* Effect.fail(new InvalidTaskInput(`Invalid assignee: must be 1-255 chars`))
    }

    const taskId = HolonBId(uuid())
    const now = new Date()
    const task = createPendingTask(taskId, brandedTitle, brandedAssignee, now)

    const version = yield* events.getVersion(taskId)
    const event = taskCreated(taskId, title, assignee, correlationId, version + 1)

    yield* repo.save(task)
    yield* events.append(taskId, event)

    if (idempotencyKey) {
      yield* idempotency.save(idempotencyKey, task)
    }

    return task
  })

// ─── Get Task ──────────────────────────────────────────────────────────────

export const getTask = (
  taskId: HolonBId,
): Effect.Effect<Task, TaskNotFound | RepositoryError, TaskRepository> =>
  Effect.gen(function* () {
    const repo = yield* TaskRepository
    const task = yield* repo.find(taskId)
    if (!task) {
      return yield* Effect.fail(new TaskNotFound(taskId))
    }
    return task
  })

// ─── Complete Task ─────────────────────────────────────────────────────────

export const completeTask = (
  taskId: HolonBId,
  correlationId: CorrelationId,
): Effect.Effect<Task, TaskError, TaskRepository | EventStore> =>
  Effect.gen(function* () {
    const repo = yield* TaskRepository
    const events = yield* EventStore

    const task = yield* repo.find(taskId)
    if (!task) {
      return yield* Effect.fail(new TaskNotFound(taskId))
    }
    if (task._status === "completed") {
      return yield* Effect.fail(new TaskAlreadyCompleted(taskId))
    }
    if (task._status === "cancelled") {
      return yield* Effect.fail(new TaskAlreadyCancelled(taskId))
    }

    const now = new Date()
    const completed = completeTaskModel(task, now)
    const version = yield* events.getVersion(taskId)
    const event = taskCompleted(taskId, now, correlationId, version + 1)

    yield* repo.update(completed)
    yield* events.append(taskId, event)

    return completed
  })

// ─── Cancel Task ───────────────────────────────────────────────────────────

export const cancelTask = (
  taskId: HolonBId,
  correlationId: CorrelationId,
  reason = "Cancelled by user",
): Effect.Effect<void, TaskError, TaskRepository | EventStore> =>
  Effect.gen(function* () {
    const repo = yield* TaskRepository
    const events = yield* EventStore

    const task = yield* repo.find(taskId)
    if (!task) {
      return yield* Effect.fail(new TaskNotFound(taskId))
    }
    if (task._status === "completed") {
      return yield* Effect.fail(new TaskAlreadyCompleted(taskId))
    }
    if (task._status === "cancelled") {
      return yield* Effect.fail(new TaskAlreadyCancelled(taskId))
    }

    const now = new Date()
    const cancelled = cancelTaskModel(task, now)
    const version = yield* events.getVersion(taskId)
    const event = taskCancelled(taskId, reason, correlationId, version + 1)

    yield* repo.update(cancelled)
    yield* events.append(taskId, event)
  })

// ─── Compensate Task (Saga rollback) ───────────────────────────────────────

export const compensateTask = (
  taskId: HolonBId,
  reason: string,
  correlationId: CorrelationId,
): Effect.Effect<void, TaskError, TaskRepository | EventStore> =>
  Effect.gen(function* () {
    const repo = yield* TaskRepository
    const events = yield* EventStore

    const task = yield* repo.find(taskId)
    if (!task) {
      return yield* Effect.fail(new TaskNotFound(taskId))
    }

    const version = yield* events.getVersion(taskId)
    const event = taskCompensated(taskId, reason, correlationId, version + 1)

    yield* repo.remove(taskId)
    yield* events.append(taskId, event)
  })
