FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY holons/holon-a/package.json holons/holon-a/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/shared/ packages/shared/
COPY holons/holon-a/ holons/holon-a/
COPY tsconfig.base.json ./
RUN pnpm --filter @holonomic/shared build && pnpm --filter @holonomic/holon-a build

FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/holons/holon-a/node_modules ./holons/holon-a/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/holons/holon-a/dist ./holons/holon-a/dist
COPY packages/shared/package.json packages/shared/
COPY holons/holon-a/package.json holons/holon-a/
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/holons/holon-a
EXPOSE 3001
CMD ["node", "dist/index.js"]
