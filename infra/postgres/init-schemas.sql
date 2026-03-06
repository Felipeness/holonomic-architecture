-- ─── Schema Isolation per Holon ────────────────────────────────────────────
-- Each holon owns its schema — logical isolation, single Postgres instance

CREATE SCHEMA IF NOT EXISTS holon_a;
CREATE SCHEMA IF NOT EXISTS holon_b;

-- ─── Holon A: Items ───────────────────────────────────────────────────────

CREATE TABLE holon_a.items (
    id          UUID PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status      VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE holon_a.events (
    id             UUID PRIMARY KEY,
    aggregate_id   UUID NOT NULL,
    event_type     VARCHAR(100) NOT NULL,
    payload        JSONB NOT NULL,
    metadata       JSONB NOT NULL DEFAULT '{}',
    version        INTEGER NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (aggregate_id, version)
);

CREATE INDEX idx_holon_a_events_aggregate ON holon_a.events (aggregate_id, version);

CREATE TABLE holon_a.snapshots (
    aggregate_id   UUID PRIMARY KEY,
    state          JSONB NOT NULL,
    version        INTEGER NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE holon_a.idempotency_keys (
    key            VARCHAR(255) PRIMARY KEY,
    response       JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Holon B: Tasks ───────────────────────────────────────────────────────

CREATE TABLE holon_b.tasks (
    id          UUID PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    assignee    VARCHAR(255) NOT NULL,
    status      VARCHAR(50) NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE holon_b.events (
    id             UUID PRIMARY KEY,
    aggregate_id   UUID NOT NULL,
    event_type     VARCHAR(100) NOT NULL,
    payload        JSONB NOT NULL,
    metadata       JSONB NOT NULL DEFAULT '{}',
    version        INTEGER NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (aggregate_id, version)
);

CREATE INDEX idx_holon_b_events_aggregate ON holon_b.events (aggregate_id, version);

CREATE TABLE holon_b.snapshots (
    aggregate_id   UUID PRIMARY KEY,
    state          JSONB NOT NULL,
    version        INTEGER NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE holon_b.idempotency_keys (
    key            VARCHAR(255) PRIMARY KEY,
    response       JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
