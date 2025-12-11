# Tools

Utility scripts and helpers that are part of the platform/tenant bootstrap and ad‑hoc maintenance.

- `platform-datasource.ts`, `tenant-datasource.ts`: shared DataSource builders for scripts.
- Migration helpers: run platform/tenant migrations, add audit columns, etc.
- One-off analysis scripts live here when needed; annotate them inline if they are temporary or experimental.

Bootstrap flow (typical):
1. Run platform migrations (e.g., via `tools/run-migrations.js`).
2. Provision platform data (tenants, users, roles) using seeds under `scripts/` or services.
3. Run tenant migrations for each tenant database as needed.

If you add new tools, include a short header comment indicating whether it is part of the official bootstrap or a one-off.
