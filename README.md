# Holonomic Architecture

Monorepo boilerplate implementing **holonomic systems** principles from "The Whole and the Part" (O Todo e a Parte). Each service is a **holon** — simultaneously autonomous and integrated — with 4 anatomical layers, CQRS, event sourcing, and cross-holon orchestration via Temporal.

> **Holon** (from Greek _holos_ "whole" + _-on_ "part"): an entity that is both a self-contained whole and a dependent part of a larger system.

## Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        CLIENT[Client / Frontend]
    end

    subgraph "Presentation"
        BFF[BFF<br/>:3000]
    end

    subgraph "Orchestration"
        TEMPORAL[Temporal Server<br/>:7233]
        TUI[Temporal UI<br/>:8233]
    end

    subgraph "Holon A — Items"
        HA_API[Fastify Server<br/>:3001]
        HA_WORKER[Temporal Worker]
        HA_SKIN[API — HTTP + Activities]
        HA_BRAIN[Domain — Domain Model]
        HA_MEMORY[Infra — Postgres schema holon_a]
        HA_IMMUNE[Resilience — Health + Idempotency]
    end

    subgraph "Holon B — Tasks"
        HB_API[Fastify Server<br/>:3002]
        HB_WORKER[Temporal Worker]
        HB_SKIN[API — HTTP + Activities]
        HB_BRAIN[Domain — Domain Model]
        HB_MEMORY[Infra — Postgres schema holon_b]
        HB_IMMUNE[Resilience — Health + Idempotency]
    end

    subgraph "Infrastructure"
        PG[(Postgres<br/>:5432)]
        REDIS[(Redis<br/>:6379)]
        OTEL[OTEL Collector<br/>:4317/4318]
        PROM[Prometheus<br/>:9090]
        GRAFANA[Grafana<br/>:3030]
    end

    CLIENT --> BFF
    BFF --> HA_API
    BFF --> HB_API
    BFF --> TEMPORAL

    TEMPORAL --> HA_WORKER
    TEMPORAL --> HB_WORKER

    HA_API --> HA_SKIN --> HA_BRAIN --> HA_MEMORY --> PG
    HA_IMMUNE --> REDIS
    HB_API --> HB_SKIN --> HB_BRAIN --> HB_MEMORY --> PG
    HB_IMMUNE --> REDIS

    HA_API --> OTEL
    HB_API --> OTEL
    BFF --> OTEL
    OTEL --> PROM --> GRAFANA
```

## Quick Start

```bash
# Clone and start everything
git clone https://github.com/your-user/holonomic-architecture.git
cd holonomic-architecture

# Start all infrastructure + services
docker compose up -d

# Verify
curl http://localhost:3000/health/live   # BFF
curl http://localhost:3001/health/live   # Holon A
curl http://localhost:3002/health/live   # Holon B
open http://localhost:8233               # Temporal UI
open http://localhost:3030               # Grafana (admin/admin)
```

## The 4 Anatomical Layers

Each holon follows the same internal anatomy, mapped from biological systems:

| Layer          | Folder        | Responsibility                                      | Book Analogy                           |
| -------------- | ------------- | --------------------------------------------------- | -------------------------------------- |
| **API**        | `api/`        | Driving adapters — HTTP routes, Temporal activities | Skin: controls what enters and exits   |
| **Domain**     | `domain/`     | Domain core — entities, services, ports             | Brain: decision-making, business rules |
| **Infra**      | `infra/`      | Driven adapters — repositories, event store         | Memory: stores and retrieves state     |
| **Resilience** | `resilience/` | Self-regulation — health checks, idempotency        | Immune system: protects integrity      |

> See branch [`book-metaphors`](../../tree/book-metaphors) for the original naming from the book (skin/brain/memory/immune).

```
holons/holon-a/src/
├── api/               # Layer 1: Driving Adapters
│   ├── http/          # REST routes
│   └── temporal/      # Temporal activities
├── domain/            # Layer 2: Domain Core
│   ├── model/         # Entities + value objects
│   ├── service/       # Domain services (Effect programs)
│   ├── port/          # Port interfaces (Context.Tag)
│   └── event/         # Domain event constructors
├── infra/             # Layer 3: Driven Adapters
│   ├── repository/    # Postgres adapter
│   ├── event-store/   # Append-only event store
│   └── migration/     # SQL migrations
└── resilience/        # Layer 4: Self-Regulation
    ├── health.ts      # Liveness + readiness probes
    └── idempotency.ts # Idempotency guard (Redis)
```

## Temporal Orchestration

All inter-holon communication goes through **Temporal workflows** — no direct holon-to-holon calls.

### Cross-Holon Saga

```
1. BFF receives request → starts Temporal workflow
2. Workflow calls createItemActivity on Holon A (task queue: holon-a-queue)
3. Workflow calls createTaskActivity on Holon B (task queue: holon-b-queue)
4. If Holon B fails → compensateItemActivity on Holon A (automatic rollback)
5. Result returned to BFF via workflow completion
```

Temporal provides: retry policies, timeouts, heartbeats, and exactly-once execution guarantees — eliminating the need for a separate message broker.

## Holonomic Principles → Code

| Principle                                 | Implementation                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| **Janus Effect** (autonomy + integration) | Each holon has its own Postgres schema + integrates via Temporal workflows |
| **4 Anatomical Layers**                   | Explicit folder structure: api/domain/infra/resilience                     |
| **Law of Imports**                        | Holons never import from each other — only from `@holonomic/shared`        |
| **Native Resilience**                     | Temporal: retry, timeout, compensation, heartbeat built-in                 |
| **Holistic Observability**                | OpenTelemetry traces + metrics across all layers                           |
| **CQRS + Event Sourcing**                 | Separate command/query handlers, append-only event store                   |
| **Idempotency**                           | Redis-backed idempotency keys on all write operations                      |
| **Saga Orchestration**                    | Temporal workflows with automatic compensation                             |
| **Parse Don't Validate**                  | Effect Schema at boundary, branded types internally                        |
| **Functional Core / Imperative Shell**    | Pure Effect programs in domain, side effects in api/infra                  |
| **Screaming Architecture**                | Folders scream purpose (api/domain/infra/resilience), not framework        |

## API Endpoints

### BFF (`:3000`)

| Method | Path                         | Description                      |
| ------ | ---------------------------- | -------------------------------- |
| `GET`  | `/health/live`               | Liveness probe                   |
| `GET`  | `/health/ready`              | Readiness probe (checks Redis)   |
| `GET`  | `/aggregate/:itemId/:taskId` | Aggregates data from both holons |
| `POST` | `/saga`                      | Starts cross-holon saga workflow |
| `POST` | `/sync`                      | Starts sync workflow             |
| `GET`  | `/workflow/:workflowId`      | Checks workflow status           |

Create item via BFF (starts cross-holon saga):

```bash
curl -X POST http://localhost:3000/saga \
    -H "Content-Type: application/json" \
    -H "x-correlation-id: demo-corr-001" \
    -d '{
        "itemName": "Blue Widget",
        "itemDescription": "Created via BFF saga",
        "taskTitle": "Review new item",
        "taskAssignee": "ops-team"
    }'
```

The response includes `itemId`, `taskId`, and `workflowId`.

Check workflow status via BFF:

```bash
curl http://localhost:3000/workflow/<workflowId>
```

### Holon A — Items (`:3001`)

| Method   | Path            | Description     |
| -------- | --------------- | --------------- |
| `GET`    | `/health/live`  | Liveness probe  |
| `GET`    | `/health/ready` | Readiness probe |
| `POST`   | `/items`        | Create item     |
| `GET`    | `/items/:id`    | Get item by ID  |
| `PUT`    | `/items/:id`    | Update item     |
| `DELETE` | `/items/:id`    | Delete item     |

### Holon B — Tasks (`:3002`)

| Method   | Path                  | Description     |
| -------- | --------------------- | --------------- |
| `GET`    | `/health/live`        | Liveness probe  |
| `GET`    | `/health/ready`       | Readiness probe |
| `POST`   | `/tasks`              | Create task     |
| `GET`    | `/tasks/:id`          | Get task by ID  |
| `POST`   | `/tasks/:id/complete` | Complete task   |
| `DELETE` | `/tasks/:id`          | Cancel task     |

## Technology Stack

| Component      | Technology          | Why                                                 |
| -------------- | ------------------- | --------------------------------------------------- |
| Runtime        | Node.js 20          | LTS, native fetch, stable                           |
| Language       | TypeScript (strict) | Type safety, branded types                          |
| Effect System  | Effect-TS           | Typed errors, DI via Context.Tag/Layer, concurrency |
| HTTP Framework | Fastify             | Performance, schema validation, plugins             |
| Orchestration  | Temporal            | Workflows, sagas, retry, compensation               |
| Database       | PostgreSQL 16       | Schemas per holon, JSONB for events                 |
| Cache          | Redis 7             | Idempotency keys, rate limiting                     |
| Observability  | OpenTelemetry       | Vendor-neutral traces + metrics                     |
| Metrics        | Prometheus          | Time-series storage                                 |
| Dashboards     | Grafana             | Pre-configured holonomic overview                   |
| Monorepo       | pnpm workspaces     | Fast, disk-efficient                                |
| Containers     | Docker Compose      | Local development, full stack                       |

## Database Strategy

Single Postgres instance with **schema-per-holon** isolation:

- `holon_a.*` — Items domain (items, events, snapshots, idempotency_keys)
- `holon_b.*` — Tasks domain (tasks, events, snapshots, idempotency_keys)

Logical isolation with zero infrastructure overhead. Each holon's repository adapter only accesses its own schema.

## Verification Checklist

After `docker compose up`:

- [ ] BFF responds: `http://localhost:3000/health/live`
- [ ] Holon A responds: `http://localhost:3001/health/live`
- [ ] Holon B responds: `http://localhost:3002/health/live`
- [ ] Temporal UI visible: `http://localhost:8233`
- [ ] Grafana visible: `http://localhost:3030` (admin/admin)
- [ ] Create item via BFF → triggers Temporal workflow → visible in Temporal UI
- [ ] Simulate HolonB failure → automatic compensation in HolonA

## License

MIT
