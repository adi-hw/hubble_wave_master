# HubbleWave Platform

## Overview
This is a multi-tenant platform built with:
- **Frontend**: React (Vite)
- **Backend**: NestJS Microservices
- **Database**: PostgreSQL
- **Identity**: NestJS svc-identity (JWT, MFA, RBAC/ABAC)
- **Storage**: MinIO

## Active Services
- **svc-identity**: Manages tenant realms and authentication.
- **svc-metadata**: Manages dynamic table definitions.
- **svc-data**: Manages dynamic record storage.
- **web-client**: The Studio UI for managing the platform.

## 🔒 Security Notice

**IMPORTANT:** This platform has undergone a comprehensive security audit (Dec 2025).
**Critical security fixes have been applied. Follow the setup steps carefully.**

See: [QUICK-START-SECURITY.md](QUICK-START-SECURITY.md) for security configuration.

## Prerequisites
- Docker & Docker Compose
- Node.js 20+ (Vite/Nx expect >=18; 20 LTS recommended)
- **PostgreSQL 16+** with UUID extension
- **Secure JWT secret** (generated, not hardcoded)

## Getting Started

### 1. **Start Infrastructure**
   ```bash
   docker-compose up -d
   ```

### 2. **Configure Environment + generate local secrets**
   ```bash
   cp .env.example .env
   npx ts-node scripts/generate-local-dev-secrets.ts >> .env
   ```
   The generator emits fresh values for every internal-only secret
   (JWT, pack signing keypair, backup signing key, DB password, instance
   token, MinIO/Typesense keys, bootstrap admin password). Review the
   appended block, then fill in external-service tokens by hand
   (Cloudflare, HuggingFace, Anthropic, OpenAI). See `SECRETS_ROTATION.md`.

### 3. **Install Dependencies**
   ```bash
   npm install
   ```

### 4. **Run Database Migrations**
   ```bash
   npm run migration:run:instance
   npm run migration:run:control-plane
   ```

### 5. **Run Services**
   ```bash
   npm run dev:all              # all services in parallel
   # or individually:
   npm run dev:identity
   npm run dev:metadata
   npm run dev:data
   npm run dev:web
   ```

### 6. **Verify Security Configuration**
   See `SECRETS_ROTATION.md` for the post-audit credential rotation
   runbook and the canonical list of required env vars.

## Environment
- Copy `.env.example` to `.env` (backend) and set secrets (`JWT_SECRET`, DB credentials).
- Frontend uses `VITE_API_URL` (in `.env.local` or `.env.example`) to point at identity API (default `http://localhost:3000/api`).
- Swagger is disabled in production by default; set `SWAGGER_ENABLED=true` to expose `/api/docs`.
- If identity and web live on different parent domains (different eTLD+1), set `REFRESH_COOKIE_SAMESITE=none` and use HTTPS so refresh cookies flow correctly; keep `secure` enabled in that case.

## Ports
- **Web Client**: http://localhost:4200
- **Identity Service**: http://localhost:3000
- **Metadata Service**: http://localhost:3333
- **Data Service**: http://localhost:3001
- **Postgres**: 5432
- **MinIO**: 9000/9001
- **Redis**: 6379

## 📚 Documentation

- **[QUICK-START-SECURITY.md](QUICK-START-SECURITY.md)** - Essential security setup (START HERE)
- **[SECURITY-FIXES-APPLIED.md](SECURITY-FIXES-APPLIED.md)** - Detailed security audit report
- **[TODO-REMAINING-FIXES.md](TODO-REMAINING-FIXES.md)** - Development roadmap
- **[FIXES-SUMMARY.md](FIXES-SUMMARY.md)** - High-level overview

## 🔐 Security Features

- ✅ **No hardcoded secrets** - JWT_SECRET required from environment
- ✅ **Account lockout** - 5 failed attempts = 30-minute lockout
- ✅ **Deny-by-default ABAC** - Explicit policies required for access
- ✅ **Argon2 password hashing** - Industry-standard security
- ✅ **Refresh token rotation** - Family-based reuse detection
- ✅ **Multi-factor authentication** - TOTP with recovery codes

## ⚠️ Security Warnings

1. **JWT_SECRET is required** - Application will not start without it
2. **Account lockout is enforced** - Users locked after 5 failed attempts
3. **Default ABAC policy is DENY** - Tables require explicit ACL configuration

## 🚀 Production Deployment

**Before deploying to production:**

1. Set all required environment variables (see `.env.example`)
2. Run all database migrations
3. Generate secure JWT_SECRET (64-byte hex string)
4. Enable HTTPS/TLS
5. Set `NODE_ENV=production`
6. Review: [SECURITY-FIXES-APPLIED.md](SECURITY-FIXES-APPLIED.md)

## Deprecated / Unused
- `apps/backend` (Deleted)
- `apps/api-gateway` (Deleted)

## 📊 Project Status

**Production Readiness:** 55% (after security fixes)
**Critical Issues:** 0
**High-Priority TODOs:** 4 (see TODO-REMAINING-FIXES.md)

## 🆘 Troubleshooting

**Error: "JWT_SECRET environment variable must be set"**
- Generate secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- Add to `.env` file

**Error: "Account is locked"**
- Wait 30 minutes OR manually reset in database
- See: [QUICK-START-SECURITY.md](QUICK-START-SECURITY.md#troubleshooting)

**Error: "Column 'failed_login_attempts' does not exist"**
- Run migration: `npm run typeorm:migration:run`

## 📝 License

MIT
