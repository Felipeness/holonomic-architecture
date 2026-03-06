import type { CorrelationId, HolonAId, HolonBId } from "../types/index.js"

// ─── Cross-Holon Saga Types ───────────────────────────────────────────────

export interface CrossHolonSagaInput {
  readonly correlationId: CorrelationId
  readonly itemName: string
  readonly itemDescription: string
  readonly taskTitle: string
  readonly taskAssignee: string
}

export interface CrossHolonSagaOutput {
  readonly itemId: HolonAId
  readonly taskId: HolonBId
  readonly correlationId: CorrelationId
}

// ─── Sync Workflow Types ──────────────────────────────────────────────────

export interface SyncWorkflowInput {
  readonly correlationId: CorrelationId
  readonly sourceHolonAId: HolonAId
}

export interface SyncWorkflowOutput {
  readonly synced: boolean
  readonly correlationId: CorrelationId
  readonly syncedAt: Date
}

// ─── Activity Input/Output Types ──────────────────────────────────────────

export interface CreateItemInput {
  readonly name: string
  readonly description: string
  readonly correlationId: CorrelationId
}

export interface CreateItemOutput {
  readonly itemId: HolonAId
}

export interface CompensateItemInput {
  readonly itemId: HolonAId
  readonly reason: string
  readonly correlationId: CorrelationId
}

export interface CreateTaskInput {
  readonly title: string
  readonly assignee: string
  readonly correlationId: CorrelationId
}

export interface CreateTaskOutput {
  readonly taskId: HolonBId
}

export interface CompensateTaskInput {
  readonly taskId: HolonBId
  readonly reason: string
  readonly correlationId: CorrelationId
}
