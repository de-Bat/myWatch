# Build context: repo root
# docker build -f apps/web/Dockerfile .

# ---- base ----
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# ---- deps ----
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json         ./packages/core/
COPY packages/sync/package.json         ./packages/sync/
COPY packages/tmdb/package.json         ./packages/tmdb/
COPY packages/plugin-sdk/package.json   ./packages/plugin-sdk/
COPY plugins/mywatch-plugin-youtube/package.json ./plugins/mywatch-plugin-youtube/
COPY apps/web/package.json              ./apps/web/

RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS builder
WORKDIR /app

COPY packages/core/src       ./packages/core/src
COPY packages/sync/src       ./packages/sync/src
COPY packages/tmdb/src       ./packages/tmdb/src
COPY packages/plugin-sdk/src ./packages/plugin-sdk/src
COPY plugins/mywatch-plugin-youtube/src ./plugins/mywatch-plugin-youtube/src

COPY apps/web/src        ./apps/web/src
COPY apps/web/scripts    ./apps/web/scripts
COPY apps/web/public     ./apps/web/public
COPY apps/web/tsconfig.json     ./apps/web/
COPY apps/web/next.config.mjs   ./apps/web/
COPY apps/web/tailwind.config.ts ./apps/web/
COPY apps/web/postcss.config.js ./apps/web/

# Build workspace packages as JS only — types resolved from source (package.json types: ./src/index.ts)
# --no-dts avoids pnpm isolated store issue where TS can't find transitive deps during DTS generation
RUN cd packages/core && pnpm exec tsup src/index.ts --format esm --no-dts
RUN cd packages/sync && pnpm exec tsup src/index.ts --format esm --no-dts
RUN cd packages/tmdb && pnpm exec tsup src/index.ts --format esm --no-dts

# Build Next.js (output: standalone)
# NEXT_PUBLIC_* vars must be provided at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_TMDB_API_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_TMDB_API_KEY=$NEXT_PUBLIC_TMDB_API_KEY

# Ensure public dir exists (COPY in runner fails if source is absent)
RUN mkdir -p apps/web/public

RUN cd apps/web && node scripts/scan-plugins.mjs && pnpm exec next build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# standalone output is self-contained
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static      ./apps/web/.next/static
COPY --from=builder /app/apps/web/public            ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
