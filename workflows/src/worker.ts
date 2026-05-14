import { NativeConnection, Worker } from "@temporalio/worker"
import { fileURLToPath } from "node:url"
import pino from "pino"

const logger = pino({ level: process.env["LOG_LEVEL"] ?? "info" })

const TEMPORAL_ADDRESS = process.env["TEMPORAL_ADDRESS"] ?? "localhost:7233"
const TEMPORAL_TASK_QUEUE = process.env["TEMPORAL_TASK_QUEUE_WORKFLOWS"] ?? "cross-holon-queue"

async function runWorker(): Promise<void> {
  const connection = await NativeConnection.connect({ address: TEMPORAL_ADDRESS })

  const worker = await Worker.create({
    connection,
    taskQueue: TEMPORAL_TASK_QUEUE,
    workflowsPath: fileURLToPath(new URL("./index.js", import.meta.url)),
  })

  logger.info(
    { temporalAddress: TEMPORAL_ADDRESS, taskQueue: TEMPORAL_TASK_QUEUE },
    "workflow worker started",
  )

  await worker.run()
}

runWorker().catch((error) => {
  logger.error({ error }, "workflow worker failed")
  process.exit(1)
})
