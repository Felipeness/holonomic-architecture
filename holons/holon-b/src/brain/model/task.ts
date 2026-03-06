import { Brand } from "effect"
import type { HolonBId } from "@holonomic/shared/types"

// ─── Value Objects (Branded Strings) ───────────────────────────────────────

export type TaskTitle = string & Brand.Brand<"TaskTitle">
export const TaskTitle = Brand.refined<TaskTitle>(
  (s) => s.length >= 1 && s.length <= 255,
  (s) => Brand.error(`TaskTitle must be 1-255 chars, got ${s.length}`),
)

export type TaskAssignee = string & Brand.Brand<"TaskAssignee">
export const TaskAssignee = Brand.refined<TaskAssignee>(
  (s) => s.length >= 1 && s.length <= 255,
  (s) => Brand.error(`TaskAssignee must be 1-255 chars, got ${s.length}`),
)

// ─── Discriminated Union: Task Status ──────────────────────────────────────

interface PendingTask {
  readonly _status: "pending"
  readonly id: HolonBId
  readonly title: TaskTitle
  readonly assignee: TaskAssignee
  readonly completedAt: null
  readonly createdAt: Date
  readonly updatedAt: Date
}

interface CompletedTask {
  readonly _status: "completed"
  readonly id: HolonBId
  readonly title: TaskTitle
  readonly assignee: TaskAssignee
  readonly completedAt: Date
  readonly createdAt: Date
  readonly updatedAt: Date
}

interface CancelledTask {
  readonly _status: "cancelled"
  readonly id: HolonBId
  readonly title: TaskTitle
  readonly assignee: TaskAssignee
  readonly completedAt: null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type Task = PendingTask | CompletedTask | CancelledTask

// ─── Constructors ──────────────────────────────────────────────────────────

export const createPendingTask = (
  id: HolonBId,
  title: TaskTitle,
  assignee: TaskAssignee,
  now: Date,
): PendingTask => ({
  _status: "pending",
  id,
  title,
  assignee,
  completedAt: null,
  createdAt: now,
  updatedAt: now,
})

export const completeTask = (task: PendingTask, now: Date): CompletedTask => ({
  _status: "completed",
  id: task.id,
  title: task.title,
  assignee: task.assignee,
  completedAt: now,
  createdAt: task.createdAt,
  updatedAt: now,
})

export const cancelTask = (task: PendingTask, now: Date): CancelledTask => ({
  _status: "cancelled",
  id: task.id,
  title: task.title,
  assignee: task.assignee,
  completedAt: null,
  createdAt: task.createdAt,
  updatedAt: now,
})
