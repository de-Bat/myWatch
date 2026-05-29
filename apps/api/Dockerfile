# Build context: repo root
# docker build -f apps/api/Dockerfile .

# ---- base ----
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# ---- deps ----
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json   ./packages/core/
COPY packages/sync/package.json   ./packages/sync/
COPY packages/tmdb/package.json   ./packages/tmdb/
COPY apps/api/package.json        ./apps/api/

RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS builder
WORKDIR /app

COPY packages/core/src  ./packages/core/src
COPY packages/sync/src  ./packages/sync/src
COPY packages/tmdb/src  ./packages/tmdb/src
COPY apps/api/src       ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/

# Build workspace packages — skip --dts (not needed at runtime, and pnpm isolated
# store causes TS to fail resolving transitive deps during declaration generation)
RUN cd packages/core && pnpm exec tsup src/index.ts --format esm --no-dts
RUN cd packages/sync && pnpm exec tsup src/index.ts --format esm --no-dts

# Build API index + migrate as separate ESM bundles (also no DTS needed)
RUN cd apps/api && pnpm exec tsup src/index.ts src/db/migrate.ts --format esm --no-dts

# Copy SQL migration files next to compiled migrate.js
# migrate.ts resolves migrations relative to __dirname → dist/db/migrations/
RUN mkdir -p apps/api/dist/db/migrations \
  && cp apps/api/src/db/migrations/*.sql apps/api/dist/db/migrations/

# pnpm deploy: resolves production node_modules incl. workspace packages
RUN pnpm --filter '@mywatch/api' deploy --prod /prod/api

# Overlay compiled output (deploy only copies source, not dist)
RUN cp -r /app/apps/api/dist /prod/api/dist

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /prod/api ./
COPY --from=builder /app/apps/api/docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
