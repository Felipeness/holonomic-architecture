import { Effect } from "effect"
import type { Pool } from "pg"
import { HolonBId } from "@holonomic/shared/types"
import type { TaskRepository } from "../../domain/port/repository.js"
import { RepositoryError } from "../../domain/port/repository.js"
import { TaskTitle, TaskAssignee, type Task } from "../../domain/model/task.js"

// ─── Row → Domain ──────────────────────────────────────────────────────────

interface TaskRow {
  id: string
  title: string
  assignee: string
  status: string
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

const rowToTask = (row: TaskRow): Task => {
  const base = {
    id: HolonBId(row.id),
    title: TaskTitle(row.title),
    assignee: TaskAssignee(row.assignee),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }

  switch (row.status) {
    case "completed":
      return { ...base, _status: "completed", completedAt: row.completed_at! }
    case "cancelled":
      return { ...base, _status: "cancelled", completedAt: null }
    default:
      return { ...base, _status: "pending", completedAt: null }
  }
}

// ─── Postgres Implementation ───────────────────────────────────────────────

export type PgTaskRepository = TaskRepository

export const makePgTaskRepository = (pool: Pool): PgTaskRepository => ({
  find: (id) =>
    Effect.tryPromise({
      try: async () => {
        const result = await pool.query<TaskRow>(
          `SELECT id, title, assignee, status, completed_at, created_at, updated_at
           FROM holon_b.tasks WHERE id = $1`,
          [id],
        )
        const row = result.rows[0]
        return row ? rowToTask(row) : null
      },
      catch: (cause) => new RepositoryError("TaskRepository.find", cause),
    }),

  save: (task) =>
    Effect.tryPromise({
      try: () =>
        pool.query(
          `INSERT INTO holon_b.tasks (id, title, assignee, status, completed_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [task.id, task.title, task.assignee, task._status, task.completedAt, task.createdAt, task.updatedAt],
        ).then(() => undefined),
      catch: (cause) => new RepositoryError("TaskRepository.save", cause),
    }),

  update: (task) =>
    Effect.tryPromise({
      try: () =>
        pool.query(
          `UPDATE holon_b.tasks
           SET title = $1, assignee = $2, status = $3, completed_at = $4, updated_at = $5
           WHERE id = $6`,
          [task.title, task.assignee, task._status, task.completedAt, task.updatedAt, task.id],
        ).then(() => undefined),
      catch: (cause) => new RepositoryError("TaskRepository.update", cause),
    }),

  remove: (id) =>
    Effect.tryPromise({
      try: () =>
        pool.query(`DELETE FROM holon_b.tasks WHERE id = $1`, [id]).then(() => undefined),
      catch: (cause) => new RepositoryError("TaskRepository.remove", cause),
    }),
})
