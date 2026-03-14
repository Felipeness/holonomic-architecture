import { Client, Connection, WorkflowExecutionAlreadyStartedError } from "@temporalio/client"
import { randomUUID } from "node:crypto"
import type { CrossHolonSagaInput, SyncWorkflowInput } from "@holonomic/shared/workflows"

// ─── Temporal Client Adapter ──────────────────────────────────────────────

export interface TemporalClientAdapter {
  readonly startCrossHolonSaga: (
    input: CrossHolonSagaInput,
  ) => Promise<{ workflowId: string; runId: string }>
  readonly startSyncWorkflow: (
    input: SyncWorkflowInput,
  ) => Promise<{ workflowId: string; runId: string }>
  readonly getWorkflowResult: <T>(workflowId: string) => Promise<T>
  readonly getWorkflowStatus: (workflowId: string) => Promise<{
    status: string
    workflowId: string
    runId: string
  }>
  readonly close: () => Promise<void>
}

export async function createTemporalClient(
  address: string,
  taskQueue: string,
): Promise<TemporalClientAdapter> {
  const connection = await Connection.connect({ address })
  const client = new Client({ connection })

  return {
    startCrossHolonSaga: async (input) => {
      const workflowId = `cross-holon-saga-${input.correlationId}-${randomUUID().slice(0, 8)}`
      try {
        const handle = await client.workflow.start("crossHolonSaga", {
          taskQueue,
          workflowId,
          args: [input],
        })
        return { workflowId: handle.workflowId, runId: handle.firstExecutionRunId }
      } catch (error) {
        if (error instanceof WorkflowExecutionAlreadyStartedError) {
          const handle = client.workflow.getHandle(workflowId)
          const desc = await handle.describe()
          return { workflowId, runId: desc.runId }
        }
        throw error
      }
    },

    startSyncWorkflow: async (input) => {
      const workflowId = `sync-workflow-${input.correlationId}-${randomUUID().slice(0, 8)}`
      const handle = await client.workflow.start("syncWorkflow", {
        taskQueue,
        workflowId,
        args: [input],
      })
      return { workflowId: handle.workflowId, runId: handle.firstExecutionRunId }
    },

    getWorkflowResult: async <T>(workflowId: string): Promise<T> => {
      const handle = client.workflow.getHandle(workflowId)
      return handle.result() as Promise<T>
    },

    getWorkflowStatus: async (workflowId) => {
      const handle = client.workflow.getHandle(workflowId)
      const desc = await handle.describe()
      return {
        status: desc.status.name,
        workflowId,
        runId: desc.runId,
      }
    },

    close: async () => {
      await connection.close()
    },
  }
}
