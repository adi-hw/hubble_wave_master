# =============================================================================
# HubbleWave Control Plane API - Dockerfile
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

# Copy the control-plane app
COPY apps/svc-control-plane/ ./apps/svc-control-plane/

# Copy control-plane relevant libs
COPY libs/control-plane-db/ ./libs/control-plane-db/
COPY libs/shared-types/ ./libs/shared-types/
COPY libs/auth-guard/ ./libs/auth-guard/
COPY libs/authorization/ ./libs/authorization/
COPY libs/redis/ ./libs/redis/
COPY libs/storage/ ./libs/storage/
COPY libs/enterprise/ ./libs/enterprise/
COPY libs/packs/ ./libs/packs/

# Copy migrations and scripts
COPY migrations/ ./migrations/
COPY scripts/ ./scripts/

# Copy tools if needed for build
COPY tools/ ./tools/

# Build the application
RUN npx nx build svc-control-plane

# Build migrations
RUN npx tsc -p scripts/tsconfig.migration.json --outDir dist

# -----------------------------------------------------------------------------
# Stage 2: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

ENV NODE_ENV=production
ENV CONTROL_PLANE_PORT=3003
ARG TERRAFORM_VERSION=1.6.6
ARG TERRAFORM_SHA256=d117883fd98b960c5d0f012b0d4b21801e1aea985e26949c2d1ebb39af074f00

# Copy package files and install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps

RUN apk add --no-cache curl unzip \
    && curl -sSLo /tmp/terraform.zip "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip" \
    && echo "${TERRAFORM_SHA256}  /tmp/terraform.zip" | sha256sum -c - \
    && unzip /tmp/terraform.zip -d /usr/local/bin \
    && rm /tmp/terraform.zip

# Copy built output
COPY --from=builder /app/dist/apps/svc-control-plane ./dist
COPY --from=builder /app/dist/migrations ./dist/migrations
COPY --from=builder /app/dist/scripts ./dist/scripts
COPY --from=builder /app/dist/libs ./dist/libs
COPY infrastructure/terraform/modules/customer-instance ./terraform/modules/customer-instance

RUN mkdir -p /app/terraform/workspaces

USER nestjs

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD ["node", "-e", "const http=require('http');const port=parseInt(process.env.CONTROL_PLANE_PORT||'3003',10);const req=http.get({hostname:'127.0.0.1',port,path:'/api/health'},res=>{if(res.statusCode!==200){process.exit(1);}res.resume();});req.on('error',()=>process.exit(1));req.setTimeout(5000,()=>{req.destroy();process.exit(1);});"]

CMD ["node", "dist/main.js"]
