import { proxyActivities } from "@temporalio/workflow"
import type {
  SyncWorkflowInput,
  SyncWorkflowOutput,
  CreateTaskInput,
  CreateTaskOutput,
} from "@holonomic/shared/workflows"
import type { CorrelationId } from "@holonomic/shared/types"

// ─── Activity Proxies ─────────────────────────────────────────────────────

interface HolonAQueryActivities {
  getItemActivity(input: {
    itemId: string
    correlationId: CorrelationId
  }): Promise<{ name: string; description: string }>
}

interface HolonBActivities {
  createTaskActivity(input: CreateTaskInput): Promise<CreateTaskOutput>
}

const holonAActivities = proxyActivities<HolonAQueryActivities>({
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

// ─── Sync Workflow ────────────────────────────────────────────────────────
// Reads an item from HolonA and creates a corresponding task in HolonB

export async function syncWorkflow(
  input: SyncWorkflowInput,
): Promise<SyncWorkflowOutput> {
  const { correlationId, sourceHolonAId } = input

  // Query item from Holon A
  const item = await holonAActivities.getItemActivity({
    itemId: sourceHolonAId as string,
    correlationId,
  })

  // Create corresponding task in Holon B
  await holonBActivities.createTaskActivity({
    title: `Synced from item: ${item.name}`,
    assignee: "system",
    correlationId,
  })

  return {
    synced: true,
    correlationId,
    syncedAt: new Date(),
  }
}
