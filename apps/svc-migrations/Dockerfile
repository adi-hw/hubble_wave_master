# =============================================================================
# HubbleWave Instance Migration Runner - Dockerfile
# =============================================================================
# Single-shot Kubernetes Job that applies pending TypeORM migrations to the
# customer instance database ahead of api/worker pods. Serialises concurrent
# invocations via Postgres advisory lock.
# =============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json ./

# Copy Nx configuration
COPY nx.json tsconfig.base.json ./
COPY eslint.config.mjs ./

# Install all dependencies
RUN npm ci --legacy-peer-deps

# Copy the migrations runner app
COPY apps/svc-migrations/ ./apps/svc-migrations/

# Copy required libs
COPY libs/instance-db/ ./libs/instance-db/
COPY libs/shared-types/ ./libs/shared-types/

# Copy migrations source
COPY migrations/instance/ ./migrations/instance/

# Build the application
RUN npx nx build svc-migrations

# -----------------------------------------------------------------------------
# Stage 2: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

ENV NODE_ENV=production

# Copy package files and install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built output + compiled migrations
COPY --from=builder /app/dist/apps/svc-migrations ./dist
COPY --from=builder /app/dist/migrations ./dist/migrations

USER nestjs

# No HEALTHCHECK — single-shot job exits on completion.

CMD ["node", "dist/main.js"]
