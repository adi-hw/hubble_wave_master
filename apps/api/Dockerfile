# =============================================================================
# HubbleWave Instance API - Dockerfile
# =============================================================================
# Modular monolith hosting all instance-plane modules:
# identity, metadata, data, automation (incl. workflow), ava, views,
# notifications, instance-api, analytics. Per spec §2 (ARC-W1 final cutover).
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

# Copy the api app + worker (consumed transitively at build time for type refs)
COPY apps/api/ ./apps/api/
COPY apps/worker/ ./apps/worker/

# Copy all shared libs (the monolith consumes most of libs/)
COPY libs/ ./libs/

# Copy migrations metadata for typeorm entity discovery
COPY migrations/instance/ ./migrations/instance/

# Copy tools if needed for build-time scripts
COPY tools/ ./tools/

# Build the application
RUN npx nx build api

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
COPY --from=builder /app/dist/apps/api ./dist

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD ["node", "-e", "const http=require('http');const port=parseInt(process.env.PORT||'3000',10);const req=http.get({hostname:'127.0.0.1',port,path:'/api/health'},res=>{if(res.statusCode!==200){process.exit(1);}res.resume();});req.on('error',()=>process.exit(1));req.setTimeout(5000,()=>{req.destroy();process.exit(1);});"]

CMD ["node", "dist/main.js"]
