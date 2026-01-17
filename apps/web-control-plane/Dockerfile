# =============================================================================
# HubbleWave Control Plane Web - Dockerfile
# Only includes control-plane specific code
# =============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Copy Nx configuration
COPY nx.json tsconfig.base.json ./
COPY eslint.config.mjs ./

# Install all dependencies
RUN npm ci --legacy-peer-deps

# Copy the control-plane web app
COPY apps/web-control-plane/ ./apps/web-control-plane/

# Copy only control-plane relevant libs
COPY libs/shared-types/ ./libs/shared-types/
COPY libs/ui/ ./libs/ui/
COPY libs/auth-guard/ ./libs/auth-guard/

# Copy tools if needed for build
COPY tools/ ./tools/

# Build arguments for environment variables
ARG VITE_CONTROL_PLANE_API_URL=https://api.hubblewave.com/api
ARG VITE_APP_ENV=production

ENV VITE_CONTROL_PLANE_API_URL=$VITE_CONTROL_PLANE_API_URL
ENV VITE_APP_ENV=$VITE_APP_ENV

# Build the application
RUN npx nx build web-control-plane

# -----------------------------------------------------------------------------
# Stage 2: Production (nginx)
# -----------------------------------------------------------------------------
FROM nginx:alpine AS runner

RUN rm /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=builder /app/dist/apps/web-control-plane /usr/share/nginx/html

# Create nginx config for SPA routing
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
