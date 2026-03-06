import * as S from "@effect/schema/Schema"

// ─── Request Schemas ───────────────────────────────────────────────────────

export const CreateTaskSchema = S.Struct({
  title: S.String.pipe(S.minLength(1), S.maxLength(255)),
  assignee: S.String.pipe(S.minLength(1), S.maxLength(255)),
})
export type CreateTaskInput = S.Schema.Type<typeof CreateTaskSchema>

export const CompleteTaskSchema = S.Struct({})
export type CompleteTaskInput = S.Schema.Type<typeof CompleteTaskSchema>

// ─── Response Schemas ──────────────────────────────────────────────────────

export const TaskResponseSchema = S.Struct({
  id: S.String,
  title: S.String,
  assignee: S.String,
  status: S.String,
  completedAt: S.NullOr(S.String),
  createdAt: S.String,
  updatedAt: S.String,
})
export type TaskResponse = S.Schema.Type<typeof TaskResponseSchema>

// ─── Params ────────────────────────────────────────────────────────────────

export const TaskIdParamsSchema = S.Struct({
  id: S.String.pipe(S.minLength(1)),
})
