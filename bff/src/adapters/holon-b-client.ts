import { Effect, Context } from "effect"

// ─── Holon B Client Port ──────────────────────────────────────────────────

export interface TaskResponse {
  readonly id: string
  readonly title: string
  readonly assignee: string
  readonly status: string
  readonly completedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreateTaskRequest {
  readonly title: string
  readonly assignee: string
}

export class HolonBClientError {
  readonly _tag = "HolonBClientError" as const
  constructor(
    readonly message: string,
    readonly statusCode?: number,
  ) {}
}

export class HolonBClient extends Context.Tag("HolonBClient")<
  HolonBClient,
  {
    readonly getTask: (
      id: string,
      correlationId: string,
    ) => Effect.Effect<TaskResponse, HolonBClientError>
    readonly createTask: (
      data: CreateTaskRequest,
      correlationId: string,
      idempotencyKey?: string,
    ) => Effect.Effect<TaskResponse, HolonBClientError>
  }
>() {}

// ─── Live Implementation ──────────────────────────────────────────────────

export const makeHolonBClient = (baseUrl: string) =>
  HolonBClient.of({
    getTask: (id, correlationId) =>
      Effect.tryPromise({
        try: async () => {
          const response = await fetch(`${baseUrl}/tasks/${id}`, {
            headers: { "x-correlation-id": correlationId },
            signal: AbortSignal.timeout(5_000),
          })
          if (!response.ok) {
            throw new HolonBClientError(`get task ${id}: ${response.statusText}`, response.status)
          }
          return (await response.json()) as TaskResponse
        },
        catch: (error) =>
          new HolonBClientError(
            `get task ${id}: ${error instanceof Error ? error.message : "unknown"}`,
          ),
      }),
    createTask: (data, correlationId, idempotencyKey) =>
      Effect.tryPromise({
        try: async () => {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "x-correlation-id": correlationId,
          }
          if (idempotencyKey) {
            headers["x-idempotency-key"] = idempotencyKey
          }
          const response = await fetch(`${baseUrl}/tasks`, {
            method: "POST",
            headers,
            body: JSON.stringify(data),
            signal: AbortSignal.timeout(5_000),
          })
          if (!response.ok) {
            throw new HolonBClientError(`create task: ${response.statusText}`, response.status)
          }
          return (await response.json()) as TaskResponse
        },
        catch: (error) =>
          new HolonBClientError(
            `create task: ${error instanceof Error ? error.message : "unknown"}`,
          ),
      }),
  })
