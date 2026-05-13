# Plan Fix 31 — Master CI Infrastructure Cleanup

**Status:** Complete (single PR)
**Owner:** adi-hw
**Effort:** 1 PR
**Related canon clauses:** §21 (enforcement infrastructure)
**Triggering audit:** CI failures observed across PRs #36-#46 — three master-wide issues blocking clean CI signal.

## Context

Three concurrent issues have been making CI noisy on every PR:

1. **ts-node ESM resolution** — Node 20+ in ESM mode fails to resolve `.ts` extensions when scanner files contain `import/export` syntax. Affects all architectural scanners + license-check.
2. **Missing `@aws-sdk/client-kms` dependency** — added to source by canon §29 PR-A (AwsKmsEs256KeySigningService) but missing from package.json. Breaks `apps/api` builds.
3. **ESLint unused-vars in `ava-automation.service.ts`** — pre-existing `catch (error)` without underscore prefix violates the `caughtErrorsIgnorePattern: '^_'` rule. Surfaces whenever apps/api files change.

## Resolution

### Issue 1: ts-node → tsx

Switched all 26 `npx ts-node` scanner/script invocations in `package.json` to `npx tsx`. `tsx` handles Node 20+ ESM natively and is a drop-in replacement for `ts-node` in script invocations. ts-node remains in devDependencies for other tooling (TypeORM CLI migration scripts at `migration:generate:*` / `migration:run:*` / `migration:revert:*` retain `ts-node -P` because they use ts-node's `-P` tsconfig flag directly with the typeorm CLI).

### Issue 2: @aws-sdk/client-kms

On investigation, `@aws-sdk/client-kms` was already present in `dependencies` at `^3.965.0` — added during the §29 PR-A work. The F031 agent report that flagged it as missing reflected a prior state before that landing. No action needed beyond confirming it is present.

### Issue 3: ava-automation lint

Renamed `catch (error)` → `catch (_error)` at `apps/api/src/app/automation/ava/ava-automation.service.ts:269`. The catch block does not reference the error variable — underscore prefix is the canonical signal for intentionally-unused caught errors under the `caughtErrorsIgnorePattern: '^_'` ESLint config.

## Files

- `package.json` — 26 `npx ts-node` → `npx tsx` + added `tsx` devDependency
- `apps/api/src/app/automation/ava/ava-automation.service.ts` — line 269 underscore prefix

## Acceptance

- All scanners run via `npx tsx` invocations
- `@aws-sdk/client-kms` confirmed present in dependencies
- `npx nx run api:lint` no longer flags line 269 unused-vars
- CI status checks (Architectural CI gates, License audit) should flip to PASSING on future PRs

## Out of scope

- Other pre-existing lint warnings in apps/api (W4 cleanup pass)
- Migrating TypeORM CLI migration scripts from `ts-node -P` to tsx — those use ts-node's `-P` flag directly with the TypeORM CLI binary; keep ts-node for those
- Investigating the SBOM/CVE high-severity finding — separate dep update concern
