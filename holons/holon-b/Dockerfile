FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ─── Install dependencies ───────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY holons/holon-b/package.json holons/holon-b/
RUN pnpm install --frozen-lockfile

# ─── Build ──────────────────────────────────────────────────────────────────
FROM deps AS build
COPY packages/shared packages/shared
COPY holons/holon-b holons/holon-b
COPY tsconfig.base.json ./
RUN pnpm --filter @holonomic/shared build && pnpm --filter @holonomic/holon-b build

# ─── Production ─────────────────────────────────────────────────────────────
FROM base AS production
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=deps /app/holons/holon-b/node_modules holons/holon-b/node_modules
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/holons/holon-b/dist holons/holon-b/dist
COPY packages/shared/package.json packages/shared/
COPY holons/holon-b/package.json holons/holon-b/

WORKDIR /app/holons/holon-b
EXPOSE 3002
CMD ["node", "dist/index.js"]
