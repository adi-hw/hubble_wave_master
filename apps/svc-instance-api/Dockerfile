# =============================================================================
# HubbleWave Instance API - Dockerfile
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

# Copy the instance-api app
COPY apps/svc-instance-api/ ./apps/svc-instance-api/

# Copy instance-api relevant libs
COPY libs/instance-db/ ./libs/instance-db/
COPY libs/shared-types/ ./libs/shared-types/
COPY libs/auth-guard/ ./libs/auth-guard/
COPY libs/authorization/ ./libs/authorization/
COPY libs/redis/ ./libs/redis/
COPY libs/packs/ ./libs/packs/
COPY libs/storage/ ./libs/storage/

# Copy migrations and scripts
COPY migrations/ ./migrations/
COPY scripts/ ./scripts/

# Copy tools if needed for build
COPY tools/ ./tools/

# Build the application
RUN npx nx build svc-instance-api

# Build migrations
RUN npx tsc -p scripts/tsconfig.migration.json --outDir dist || true

# -----------------------------------------------------------------------------
# Stage 2: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

ENV NODE_ENV=production
ENV PORT=3000

# Copy package files and install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built output
COPY --from=builder /app/dist/apps/svc-instance-api ./dist

# Copy compiled migrations and datasource scripts
COPY --from=builder /app/dist/migrations ./dist/migrations
COPY --from=builder /app/dist/scripts ./dist/scripts

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD ["node", "-e", "const http=require('http');const port=parseInt(process.env.PORT||'3000',10);const req=http.get({hostname:'127.0.0.1',port,path:'/api/health'},res=>{if(res.statusCode!==200){process.exit(1);}res.resume();});req.on('error',()=>process.exit(1));req.setTimeout(5000,()=>{req.destroy();process.exit(1);});"]

CMD ["node", "dist/main.js"]
