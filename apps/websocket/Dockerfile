# websocket Dockerfile (Bun + Elysia)
FROM oven/bun:1.3.6-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy root package files
COPY package.json bun.lock ./
COPY turbo.json ./

# Copy workspace package files
COPY apps/websocket/package.json apps/websocket/
COPY packages/database/package.json packages/database/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/env/package.json packages/env/
COPY packages/utils/package.json packages/utils/

# Install dependencies
RUN bun install

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/websocket/node_modules ./apps/websocket/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules

# Copy source files
COPY . .

# Ensure build-time env validation has values by copying example env into app and database folders
RUN cp .env.example apps/websocket/.env || true
RUN cp .env.example packages/database/.env || true

## Generate Prisma client
RUN cd packages/database && bun run generate

# Ensure app-level node_modules point to the hoisted root node_modules (fix Bun module resolution)
RUN [ -e apps/websocket/node_modules ] || ln -s /app/node_modules apps/websocket/node_modules || true
RUN [ -e packages/database/node_modules ] || ln -s /app/node_modules packages/database/node_modules || true

# Prune the monorepo for websocket
RUN bun install -g turbo
RUN turbo prune @repo/websocket --docker

# Production stage
FROM base AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 bunuser

# Copy pruned workspace
COPY --from=builder --chown=bunuser:nodejs /app/out/json/ .
COPY --from=builder --chown=bunuser:nodejs /app/out/bun.lock ./bun.lock

# Install production dependencies only
RUN bun install

# Copy built application
COPY --from=builder --chown=bunuser:nodejs /app/out/full/ .
COPY --from=builder --chown=bunuser:nodejs /app/packages/database/generated ./packages/database/generated

# Ensure app-level node_modules point to the hoisted root node_modules at runtime
RUN [ -e apps/websocket/node_modules ] || ln -s /app/node_modules apps/websocket/node_modules || true
RUN [ -e packages/database/node_modules ] || ln -s /app/node_modules packages/database/node_modules || true

# Fallback: ensure app source is present in the image (if prune omitted files)
COPY --from=builder --chown=bunuser:nodejs /app/apps/websocket ./apps/websocket

# Install production dependencies for the websocket app at runtime to ensure node_modules exist
RUN cd apps/websocket && bun install --production || true

ARG PORT_WEBSOCKET
USER bunuser

EXPOSE ${PORT_WEBSOCKET}

ENV NODE_ENV=production
ENV PORT=${PORT_WEBSOCKET}

CMD ["bun", "run", "apps/websocket/src/index.ts"]
