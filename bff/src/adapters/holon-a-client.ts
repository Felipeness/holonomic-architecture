import { Effect, Context } from "effect"

// ─── Holon A Client Port ──────────────────────────────────────────────────

export interface ItemResponse {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly status: string
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreateItemRequest {
  readonly name: string
  readonly description: string
}

export class HolonAClientError {
  readonly _tag = "HolonAClientError" as const
  constructor(
    readonly message: string,
    readonly statusCode?: number,
  ) {}
}

export class HolonAClient extends Context.Tag("HolonAClient")<
  HolonAClient,
  {
    readonly getItem: (
      id: string,
      correlationId: string,
    ) => Effect.Effect<ItemResponse, HolonAClientError>
    readonly createItem: (
      data: CreateItemRequest,
      correlationId: string,
      idempotencyKey?: string,
    ) => Effect.Effect<ItemResponse, HolonAClientError>
  }
>() {}

// ─── Live Implementation ──────────────────────────────────────────────────

export const makeHolonAClient = (baseUrl: string) =>
  HolonAClient.of({
    getItem: (id, correlationId) =>
      Effect.tryPromise({
        try: async () => {
          const response = await fetch(`${baseUrl}/items/${id}`, {
            headers: { "x-correlation-id": correlationId },
            signal: AbortSignal.timeout(5_000),
          })
          if (!response.ok) {
            throw new HolonAClientError(`get item ${id}: ${response.statusText}`, response.status)
          }
          return (await response.json()) as ItemResponse
        },
        catch: (error) =>
          new HolonAClientError(
            `get item ${id}: ${error instanceof Error ? error.message : "unknown"}`,
          ),
      }),
    createItem: (data, correlationId, idempotencyKey) =>
      Effect.tryPromise({
        try: async () => {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "x-correlation-id": correlationId,
          }
          if (idempotencyKey) {
            headers["x-idempotency-key"] = idempotencyKey
          }
          const response = await fetch(`${baseUrl}/items`, {
            method: "POST",
            headers,
            body: JSON.stringify(data),
            signal: AbortSignal.timeout(5_000),
          })
          if (!response.ok) {
            throw new HolonAClientError(`create item: ${response.statusText}`, response.status)
          }
          return (await response.json()) as ItemResponse
        },
        catch: (error) =>
          new HolonAClientError(
            `create item: ${error instanceof Error ? error.message : "unknown"}`,
          ),
      }),
  })
