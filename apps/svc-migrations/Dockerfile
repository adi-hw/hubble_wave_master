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

# Build the application (bundles svc-migrations/src/main.ts → dist/apps/svc-migrations/main.js
# via webpack). main.js is the entrypoint; the migration files themselves load at
# runtime via the TypeORM `migrations:` glob and must be compiled separately.
RUN npx nx build svc-migrations

# Compile migrations/instance/**/*.ts → dist/migrations/instance/*.js.
# main.ts's DataSource resolves `migrations: ['dist/migrations/instance/*.js']`
# at runtime; webpack does not emit those files because they are loaded via
# glob rather than imported by main.ts. The dedicated tsconfig handles the
# one migration (1930900000001-backfill-audit-log-hash-chain.ts) that imports
# from `@hubblewave/instance-db` — rootDir is the workspace root so the lib
# resolves through tsconfig paths.
RUN npx tsc -p apps/svc-migrations/tsconfig.migrations.json

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

# NOTE: the one migration that `require('@hubblewave/instance-db')` at runtime
# (1930900000001-backfill-audit-log-hash-chain.ts) depends on Nx's
# copy-workspace-modules producing dist/apps/svc-migrations/workspace_modules
# alongside main.js. The svc-migrations nx target chain (`prune`) is broken at
# this commit (the `apps/svc-migrations/package.json` it expects does not
# exist). That's tracked as a follow-up; the immediate fix here resolves the
# missing `dist/migrations/instance/*.js` and `migrationsTransactionMode: 'each'`
# regressions that block every other migration from running.

USER nestjs

# No HEALTHCHECK — single-shot job exits on completion.

CMD ["node", "dist/main.js"]
