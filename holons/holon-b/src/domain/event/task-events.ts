import { v4 as uuid } from "uuid"
import type {
  TaskCreated,
  TaskCompleted,
  TaskCancelled,
  TaskCompensated,
} from "@holonomic/shared/events/holon-b.events"
import { EventId, type CorrelationId, type HolonBId } from "@holonomic/shared/types"

const eventMeta = (correlationId: CorrelationId, version: number) => ({
  eventId: EventId(uuid()),
  correlationId,
  timestamp: new Date(),
  version,
})

export const taskCreated = (
  taskId: HolonBId,
  title: string,
  assignee: string,
  correlationId: CorrelationId,
  version: number,
): TaskCreated => ({
  _tag: "TaskCreated",
  metadata: eventMeta(correlationId, version),
  payload: { taskId, title, assignee },
})

export const taskCompleted = (
  taskId: HolonBId,
  completedAt: Date,
  correlationId: CorrelationId,
  version: number,
): TaskCompleted => ({
  _tag: "TaskCompleted",
  metadata: eventMeta(correlationId, version),
  payload: { taskId, completedAt },
})

export const taskCancelled = (
  taskId: HolonBId,
  reason: string,
  correlationId: CorrelationId,
  version: number,
): TaskCancelled => ({
  _tag: "TaskCancelled",
  metadata: eventMeta(correlationId, version),
  payload: { taskId, reason },
})

export const taskCompensated = (
  taskId: HolonBId,
  reason: string,
  correlationId: CorrelationId,
  version: number,
): TaskCompensated => ({
  _tag: "TaskCompensated",
  metadata: eventMeta(correlationId, version),
  payload: { taskId, reason },
})
