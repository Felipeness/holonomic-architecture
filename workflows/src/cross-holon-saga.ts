import { proxyActivities, ApplicationFailure } from "@temporalio/workflow"
import type {
  CrossHolonSagaInput,
  CrossHolonSagaOutput,
  CreateItemInput,
  CreateItemOutput,
  CompensateItemInput,
  CreateTaskInput,
  CreateTaskOutput,
} from "@holonomic/shared/workflows"

// ─── Activity Proxies ─────────────────────────────────────────────────────
// Activities run in their respective holon workers (separate task queues)

interface HolonAActivities {
  createItemActivity(input: CreateItemInput): Promise<CreateItemOutput>
  compensateItemActivity(input: CompensateItemInput): Promise<void>
}

interface HolonBActivities {
  createTaskActivity(input: CreateTaskInput): Promise<CreateTaskOutput>
}

const holonAActivities = proxyActivities<HolonAActivities>({
  taskQueue: "holon-a-queue",
  startToCloseTimeout: "30s",
  retry: {
    maximumAttempts: 3,
    initialInterval: "1s",
    backoffCoefficient: 2,
  },
})

const holonBActivities = proxyActivities<HolonBActivities>({
  taskQueue: "holon-b-queue",
  startToCloseTimeout: "30s",
  retry: {
    maximumAttempts: 3,
    initialInterval: "1s",
    backoffCoefficient: 2,
  },
})

// ─── Cross-Holon Saga Workflow ────────────────────────────────────────────
// Orchestrates: Create Item (HolonA) → Create Task (HolonB)
// Compensates: If HolonB fails → Rollback Item in HolonA

export async function crossHolonSaga(
  input: CrossHolonSagaInput,
): Promise<CrossHolonSagaOutput> {
  const { correlationId, itemName, itemDescription, taskTitle, taskAssignee } =
    input

  // Step 1: Create item in Holon A
  const itemResult = await holonAActivities.createItemActivity({
    name: itemName,
    description: itemDescription,
    correlationId,
  })

  // Step 2: Create task in Holon B
  let taskResult: CreateTaskOutput
  try {
    taskResult = await holonBActivities.createTaskActivity({
      title: taskTitle,
      assignee: taskAssignee,
      correlationId,
    })
  } catch (error) {
    // Compensation: rollback item creation in Holon A
    await holonAActivities.compensateItemActivity({
      itemId: itemResult.itemId,
      reason: `Task creation failed in HolonB: ${error instanceof Error ? error.message : "unknown"}`,
      correlationId,
    })

    throw ApplicationFailure.nonRetryable(
      `Cross-holon saga failed: HolonB task creation failed, HolonA item compensated`,
      "SAGA_COMPENSATION",
      { itemId: itemResult.itemId, correlationId },
    )
  }

  return {
    itemId: itemResult.itemId,
    taskId: taskResult.taskId,
    correlationId,
  }
}
