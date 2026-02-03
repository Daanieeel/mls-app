# Website Dockerfile (Next.js)
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install Bun
RUN npm install -g bun@1.3.6

# Copy root package files
COPY package.json bun.lock ./
COPY turbo.json ./

# Copy workspace package files
COPY apps/website/package.json apps/website/
COPY apps/rest/package.json apps/rest/
COPY packages/api/package.json packages/api/
COPY packages/database/package.json packages/database/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/env/package.json packages/env/

# Install dependencies
RUN bun install

# Builder stage
FROM base AS builder
WORKDIR /app

# Install Bun
RUN npm install -g bun@1.3.6

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/website/node_modules ./apps/website/node_modules
COPY --from=deps /app/apps/rest/node_modules ./apps/rest/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules

# Copy source files
COPY . .

# Ensure build-time env validation has values by copying example env into app and database folders
RUN cp .env.example apps/website/.env || true
RUN cp .env.example packages/database/.env || true

# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED=1

RUN cd apps/website && bun run build

# Ensure app-level node_modules point to the hoisted root node_modules (fix Bun module resolution)
RUN [ -e apps/website/node_modules ] || ln -s /app/node_modules apps/website/node_modules || true
RUN [ -e packages/database/node_modules ] || ln -s /app/node_modules packages/database/node_modules || true

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/apps/website/public ./apps/website/public

# Set the correct permission for prerender cache
RUN mkdir -p apps/website/.next
RUN chown nextjs:nodejs apps/website/.next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/apps/website/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/website/.next/static ./apps/website/.next/static

ARG PORT_WEBSITE
USER nextjs

EXPOSE ${PORT_WEBSITE}

ENV PORT=${PORT_WEBSITE}
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/website/server.js"]

# Fallback: ensure app source is present in the image (if prune omitted files)
COPY --from=builder --chown=nextjs:nodejs /app/apps/website ./apps/website
