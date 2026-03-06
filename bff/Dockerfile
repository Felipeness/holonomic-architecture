FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY bff/package.json ./bff/
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/bff/node_modules ./bff/node_modules
COPY packages/shared ./packages/shared
COPY bff ./bff
COPY tsconfig.base.json ./
RUN pnpm --filter @holonomic/shared build && pnpm --filter @holonomic/bff build

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/bff/node_modules ./bff/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/bff/dist ./bff/dist
COPY packages/shared/package.json ./packages/shared/
COPY bff/package.json ./bff/

EXPOSE 3000
CMD ["node", "bff/dist/index.js"]
