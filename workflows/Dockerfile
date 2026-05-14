FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY workflows/package.json workflows/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/shared/ packages/shared/
COPY workflows/ workflows/
COPY tsconfig.base.json ./
RUN pnpm --filter @holonomic/shared build && pnpm --filter @holonomic/workflows build

FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/workflows/node_modules ./workflows/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/workflows/dist ./workflows/dist
COPY packages/shared/package.json packages/shared/
COPY workflows/package.json workflows/

WORKDIR /app/workflows
CMD ["node", "dist/worker.js"]
