import { Context, Effect } from "effect"
import type { Task } from "../model/task.js"
import type { HolonBId } from "@holonomic/shared/types"
import type { HolonBEvent } from "@holonomic/shared/events/holon-b.events"

// ─── TaskRepository Port ───────────────────────────────────────────────────

export interface TaskRepository {
  readonly find: (id: HolonBId) => Effect.Effect<Task | null, RepositoryError>
  readonly save: (task: Task) => Effect.Effect<void, RepositoryError>
  readonly update: (task: Task) => Effect.Effect<void, RepositoryError>
  readonly remove: (id: HolonBId) => Effect.Effect<void, RepositoryError>
}

export const TaskRepository = Context.GenericTag<TaskRepository>("TaskRepository")

// ─── EventStore Port ───────────────────────────────────────────────────────

export interface EventStore {
  readonly append: (
    aggregateId: HolonBId,
    event: HolonBEvent,
  ) => Effect.Effect<void, RepositoryError>
  readonly getEvents: (
    aggregateId: HolonBId,
  ) => Effect.Effect<ReadonlyArray<HolonBEvent>, RepositoryError>
  readonly getVersion: (
    aggregateId: HolonBId,
  ) => Effect.Effect<number, RepositoryError>
}

export const EventStore = Context.GenericTag<EventStore>("EventStore")

// ─── IdempotencyGuard Port ─────────────────────────────────────────────────

export interface IdempotencyGuard {
  readonly check: (
    key: string,
  ) => Effect.Effect<{ exists: boolean; response: unknown | null }, RepositoryError>
  readonly save: (
    key: string,
    response: unknown,
  ) => Effect.Effect<void, RepositoryError>
}

export const IdempotencyGuard = Context.GenericTag<IdempotencyGuard>("IdempotencyGuard")

// ─── Repository Error ──────────────────────────────────────────────────────

export class RepositoryError {
  readonly _tag = "RepositoryError" as const
  constructor(
    readonly operation: string,
    readonly cause: unknown,
  ) {}
}
