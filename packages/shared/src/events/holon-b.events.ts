import type { DomainEvent, HolonBId } from "../types/index.js"

// ─── Holon B Domain Events (Tasks) ────────────────────────────────────────

export interface TaskCreatedPayload {
  readonly taskId: HolonBId
  readonly title: string
  readonly assignee: string
}

export interface TaskCompletedPayload {
  readonly taskId: HolonBId
  readonly completedAt: Date
}

export interface TaskCancelledPayload {
  readonly taskId: HolonBId
  readonly reason: string
}

export interface TaskCompensatedPayload {
  readonly taskId: HolonBId
  readonly reason: string
}

export type TaskCreated = DomainEvent<"TaskCreated", TaskCreatedPayload>
export type TaskCompleted = DomainEvent<"TaskCompleted", TaskCompletedPayload>
export type TaskCancelled = DomainEvent<"TaskCancelled", TaskCancelledPayload>
export type TaskCompensated = DomainEvent<"TaskCompensated", TaskCompensatedPayload>

export type HolonBEvent = TaskCreated | TaskCompleted | TaskCancelled | TaskCompensated
