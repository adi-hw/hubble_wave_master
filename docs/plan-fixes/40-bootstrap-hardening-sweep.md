# Plan Fix 40 — End-to-end Bootstrap Hardening Sweep

**Status:** Complete (single PR)
**Owner:** adi-hw
**Effort:** 1 PR
**Related canon clauses:** §1 (greenfield discipline)
**Triggering audit:** End-to-end local bootstrap testing surfaced 10 distinct issues; Plan Fixes 38 + 39 covered 7. This PR closes 3 more (AWS_REGION, CACHE_MANAGER in GridModule, ActionHandlerService in SchedulingModule) plus a proactive sweep for similar latent DI wiring issues.

## Context

The cumulative pattern: agents over recent sessions shipped code that passed compile + scanners + tests but never actually booted end-to-end. Each "service can't construct because module is missing an import" issue is the same shape. The root cause is that NestJS DI resolution errors only surface at module initialization time during a real boot — they are invisible to the TypeScript compiler, unit tests that mock dependencies, and all 9 architectural scanners.

## What landed

### Fix 1: AWS_REGION + ConnectorCredentialsService

`ConnectorCredentialsService` was throwing in its constructor when `AWS_REGION`/`CONNECTOR_SECRETS_REGION` was absent, making the entire API server unbootable even when no integration feature was used.

Two-part fix:
- `scripts/setup.ts` — added `AWS_REGION=us-east-1` to the canonical generated `.env` block and added `AWS_REGION` to `REQUIRED_ENV_VARS` so stale `.env` files are detected on next run.
- `apps/api/src/app/data/integration/connector-credentials.service.ts` — refactored constructor to not throw. Region is now read lazily in a private `getClient()` method called only when `resolveCredentials()` actually executes. The strict check (no silent fallback — still throws on missing region) is preserved, but deferred to first credential-providing call rather than module load.

### Fix 2: GridModule wiring for CACHE_MANAGER

`GridModule` declares `ModelRegistryService` as its own provider instance (separate from the one in `DataModule`). `ModelRegistryService` injects `@Inject(CACHE_MANAGER)`, but `GridModule` had no `CacheModule` import — so the token was unresolvable in that scope.

Fix: added `CacheModule.register({ ttl: 30_000, max: 1000 })` to `GridModule`'s imports, matching the TTL/max configuration already used in `DataModule`. `@Optional()` was not used because the cache is load-bearing for this service (all hot paths check the cache before hitting the DB).

File: `apps/api/src/app/data/grid/grid.module.ts`

### Fix 3: AutomationRuntimeModule exports for SchedulerService

`SchedulerService` (in `SchedulingModule`) imports and injects three services from `AutomationRuntimeModule` directly: `ActionHandlerService`, `ScriptSandboxService`, and `ExecutionLogService`. `AutomationRuntimeModule` had only `AutomationRuntimeService`, `ExecutionLogService`, and `ConditionEvaluatorService` in its `exports` array — so `ActionHandlerService` and `ScriptSandboxService` were not visible to consuming modules.

Fix: added `ActionHandlerService` and `ScriptSandboxService` to `AutomationRuntimeModule`'s exports array with an explanatory comment noting that `SchedulerService` is a consumer.

File: `apps/api/src/app/automation/runtime/automation-runtime.module.ts`

### Proactive sweep findings — 2 additional latent DI wirings fixed

Static audit of `@Injectable` constructors against their hosting module imports found:

**4a. IntegrationModule — EventEmitter2 missing** (`apps/api/src/app/data/integration/integration.module.ts`)

Three services in `IntegrationModule` (`ConnectorService`, `ImportExportService`, `WebhookService`) inject `EventEmitter2` from `@nestjs/event-emitter`. `IntegrationModule` did not import `EventEmitterModule`. The service was working only because `MetadataModule` (which appears earlier in `AppModule`'s imports array) calls `EventEmitterModule.forRoot()` first, registering `EventEmitter2` globally — but this is an import-order dependency, not explicit wiring. Fix: added `EventEmitterModule.forRoot()` to `IntegrationModule`'s imports.

**4b. WorkflowModule — EventEmitter2 missing** (`apps/api/src/app/automation/workflow/workflow.module.ts`)

`WorkflowApprovalService` and `WorkflowSlaService` inject `EventEmitter2`. `WorkflowModule` did not import `EventEmitterModule`. Same latent issue as above. Fix: added `EventEmitterModule.forRoot()` to `WorkflowModule`'s imports.

`EventEmitterModule.forRoot()` is safe to call in multiple modules — NestJS deduplicates global module registrations. The pattern was already established in 3 other modules (`SchedulingModule`, `AvaModule`, `MetadataModule`) before this PR.

## Acceptance criteria

- `apps/api` boots without DI resolution errors (DB connection errors are expected without local Postgres — those come after DI completes)
- All 9 architectural scanners green
- `ConnectorCredentialsService` no longer throws at module load when `AWS_REGION` is absent
- `ModelRegistryService` inside `GridModule` resolves its `CACHE_MANAGER` dependency
- `SchedulerService` resolves `ActionHandlerService` and `ScriptSandboxService` from `AutomationRuntimeModule`
- Fresh `npm run setup` generates an `.env` with `AWS_REGION`; existing stale `.env` files missing `AWS_REGION` prompt the user to regenerate

## Out of scope

- A CI step that boots the platform pre-merge (suggested follow-up — would have caught all 10 issues from this and prior plan fixes at PR time rather than bootstrap time)
- Other latent runtime issues that only surface against a live database / Redis / connector
