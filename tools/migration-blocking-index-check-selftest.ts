#!/usr/bin/env ts-node
/**
 * Self-test for tools/migration-blocking-index-check.ts (W6.A / F046).
 *
 * The scanner does a SHALLOW scan of each migration directory (top-level
 * .ts files only). Fixtures must therefore be written directly into
 * migrations/instance/ — NOT into subdirectories. We use a 9999xxxxxxxx
 * timestamp prefix to make fixtures clearly identifiable and unlikely
 * to collide with real migrations.
 *
 * Asserts:
 *   1. Scanner exits 0 against current migration tree (no violations).
 *   2. Blocking CREATE INDEX on audit_logs (growth table) → flagged.
 *   3. CONCURRENTLY on audit_logs but no `transaction = false` → flagged.
 *   4. Blocking CREATE INDEX on `collections` (small ref table) → NOT flagged.
 *   5. CONCURRENTLY + `static transaction = false` on audit_logs → NOT flagged.
 *   6. Blocking CREATE INDEX on a cust__ table (prefix match) → flagged.
 *   7. Fully-correct refresh_tokens index → NOT flagged.
 *   8. Same-migration-table-creation exception (Pre-W2 / Task 3): a migration
 *      that BOTH creates a growth table AND creates a blocking index on it →
 *      NOT flagged (table is empty at index-build time).
 *   9. Schema-qualified blocking CREATE INDEX (`ON identity.refresh_tokens`)
 *      → flagged (regex previously captured the schema name `identity` and
 *      silently passed; W2 Task 3 regex fix catches this).
 *  10. Same-migration exception with schema-qualified refs: creates
 *      `CREATE TABLE identity.audit_logs ...` + `CREATE INDEX ... ON
 *      identity.audit_logs ...` → NOT flagged.
 *  11. Same-migration exception does NOT cover Check 2: a migration that
 *      creates a growth table AND uses CONCURRENTLY on it but omits
 *      `static transaction = false` → still flagged (CONCURRENTLY can never
 *      run inside a transaction regardless of when the table was created).
 *
 * Per scanner-self-test.ts contract: framework helpers are duplicated
 * here rather than imported (~70 lines), to avoid ts-node ESM
 * cross-file resolution pain. Tools are scripts, not application code.
 */

import { execSync } from 'child_process';
import { writeFileSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Framework helpers (duplicated from scanner-self-test.ts per contract)
// ─────────────────────────────────────────────────────────────────────────────

interface ScannerSelfTestInput {
  scannerCommand: string;
  fixturePath: string;
  fixtureContent: string;
}

interface ScannerSelfTestResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runScannerOnFixture(input: ScannerSelfTestInput): ScannerSelfTestResult {
  const cwd = process.cwd();
  const absPath = resolve(cwd, input.fixturePath);
  if (existsSync(absPath)) {
    throw new Error(`refuses to overwrite existing file: ${absPath}`);
  }
  writeFileSync(absPath, input.fixtureContent, 'utf-8');

  let stdout = '';
  let stderr = '';
  let exitCode = 0;
  try {
    stdout = execSync(input.scannerCommand, {
      encoding: 'utf-8',
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e: unknown) {
    const err = e as {
      status?: number;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };
    exitCode = err.status ?? 1;
    stdout =
      typeof err.stdout === 'string'
        ? err.stdout
        : (err.stdout?.toString('utf-8') ?? '');
    stderr =
      typeof err.stderr === 'string'
        ? err.stderr
        : (err.stderr?.toString('utf-8') ?? '');
  }
  try {
    rmSync(absPath, { force: true });
  } catch {
    // tolerated
  }
  return { exitCode, stdout, stderr };
}

function createSelfTest(name: string) {
  const failures: string[] = [];
  let passed = 0;
  return {
    assert(condition: boolean, message: string) {
      if (condition) {
        passed += 1;
        console.log(`  PASS  ${message}`);
      } else {
        failures.push(message);
        console.error(`  FAIL  ${message}`);
      }
    },
    report() {
      const total = passed + failures.length;
      console.log(`\n[${name}] ${passed}/${total} assertions passed.`);
      if (failures.length > 0) {
        console.error(`[${name}] FAILED (${failures.length}):`);
        for (const f of failures) console.error(`  - ${f}`);
        process.exit(1);
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

const t = createSelfTest('migration-blocking-index-check');

// ── Test 1: Current migration tree is clean ──────────────────────────────────
{
  let exitCode = 0;
  let stdout = '';
  try {
    stdout = execSync('npm run migrations:check', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string };
    exitCode = err.status ?? 1;
    stdout = err.stdout ?? '';
  }
  t.assert(
    exitCode === 0,
    `scanner exits 0 against current migration tree (got exit ${exitCode})`,
  );
  t.assert(
    /migrations:check: ok/.test(stdout),
    'scanner reports clean status',
  );
}

// ── Test 2: Blocking CREATE INDEX on audit_logs (growth table) → flagged ─────
// Fixture placed at top level of migrations/instance/ (scanner is shallow).
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run migrations:check',
    fixturePath: 'migrations/instance/9999900000000-selftest-bad-audit-index.ts',
    fixtureContent: [
      "import { MigrationInterface, QueryRunner } from 'typeorm';",
      '',
      'export class SelftestBadAuditIndex9999900000000 implements MigrationInterface {',
      "  name = 'SelftestBadAuditIndex9999900000000';",
      '',
      '  public async up(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(',
      '      `CREATE INDEX "idx_audit_logs_selftest" ON "audit_logs" ("user_id")`,',
      '    );',
      '  }',
      '',
      '  public async down(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_logs_selftest"`);',
      '  }',
      '}',
    ].join('\n'),
  });
  t.assert(
    result.exitCode !== 0,
    `blocking CREATE INDEX on audit_logs fails scanner (got exit ${result.exitCode})`,
  );
  t.assert(
    /audit_logs/.test(result.stdout + result.stderr),
    'scanner output mentions the growth table',
  );
  t.assert(
    /migrations:check failed/.test(result.stdout + result.stderr),
    'scanner reports failure header',
  );
}

// ── Test 3: CONCURRENTLY present but no `transaction = false` → flagged ──────
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run migrations:check',
    fixturePath: 'migrations/instance/9999900000001-selftest-concurrent-no-flag.ts',
    fixtureContent: [
      "import { MigrationInterface, QueryRunner } from 'typeorm';",
      '',
      'export class SelftestConcurrentNoFlag9999900000001 implements MigrationInterface {',
      "  name = 'SelftestConcurrentNoFlag9999900000001';",
      '  // The transaction property flag is intentionally absent here.',
      '',
      '  public async up(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(',
      '      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_audit_selftest_c" ON "audit_logs" ("created_at")`,',
      '    );',
      '  }',
      '',
      '  public async down(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(',
      '      `DROP INDEX CONCURRENTLY IF EXISTS "idx_audit_selftest_c"`,',
      '    );',
      '  }',
      '}',
    ].join('\n'),
  });
  t.assert(
    result.exitCode !== 0,
    `CONCURRENTLY without transaction = false fails scanner (got exit ${result.exitCode})`,
  );
  t.assert(
    /transaction = false/.test(result.stdout + result.stderr),
    'scanner output mentions the missing transaction = false',
  );
}

// ── Test 4: Blocking CREATE INDEX on `collections` (ref table) → NOT flagged ─
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run migrations:check',
    fixturePath: 'migrations/instance/9999900000002-selftest-ok-collections-index.ts',
    fixtureContent: [
      "import { MigrationInterface, QueryRunner } from 'typeorm';",
      '',
      'export class SelftestOkCollectionsIndex9999900000002 implements MigrationInterface {',
      "  name = 'SelftestOkCollectionsIndex9999900000002';",
      '',
      '  public async up(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(',
      '      `CREATE INDEX "idx_collections_name_selftest" ON "collections" ("name")`,',
      '    );',
      '  }',
      '',
      '  public async down(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(`DROP INDEX IF EXISTS "idx_collections_name_selftest"`);',
      '  }',
      '}',
    ].join('\n'),
  });
  t.assert(
    result.exitCode === 0,
    `blocking CREATE INDEX on non-growth table collections is allowed (got exit ${result.exitCode})`,
  );
  t.assert(
    /migrations:check: ok/.test(result.stdout + result.stderr),
    'scanner reports clean for non-growth table',
  );
}

// ── Test 5: CONCURRENTLY + `static transaction = false` on audit_logs → OK ───
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run migrations:check',
    fixturePath: 'migrations/instance/9999900000003-selftest-correct-concurrent.ts',
    fixtureContent: [
      "import { MigrationInterface, QueryRunner } from 'typeorm';",
      '',
      'export class SelftestCorrectConcurrent9999900000003 implements MigrationInterface {',
      "  name = 'SelftestCorrectConcurrent9999900000003';",
      '  static transaction = false;',
      '',
      '  public async up(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(',
      '      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_audit_logs_selftest_ok" ON "audit_logs" ("user_id", "created_at")`,',
      '    );',
      '  }',
      '',
      '  public async down(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(',
      '      `DROP INDEX CONCURRENTLY IF EXISTS "idx_audit_logs_selftest_ok"`,',
      '    );',
      '  }',
      '}',
    ].join('\n'),
  });
  t.assert(
    result.exitCode === 0,
    `CONCURRENTLY + transaction = false on audit_logs passes scanner (got exit ${result.exitCode})`,
  );
  t.assert(
    /migrations:check: ok/.test(result.stdout + result.stderr),
    'scanner reports clean for fully-compliant migration',
  );
}

// ── Test 6: Blocking CREATE INDEX on cust__ table (prefix match) → flagged ───
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run migrations:check',
    fixturePath: 'migrations/instance/9999900000004-selftest-bad-cust-table.ts',
    fixtureContent: [
      "import { MigrationInterface, QueryRunner } from 'typeorm';",
      '',
      'export class SelftestBadCustTable9999900000004 implements MigrationInterface {',
      "  name = 'SelftestBadCustTable9999900000004';",
      '',
      '  public async up(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(',
      '      `CREATE INDEX "idx_cust_selftest" ON "cust__acme__work_orders" ("status")`,',
      '    );',
      '  }',
      '',
      '  public async down(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cust_selftest"`);',
      '  }',
      '}',
    ].join('\n'),
  });
  t.assert(
    result.exitCode !== 0,
    `blocking CREATE INDEX on cust__ table fails scanner (got exit ${result.exitCode})`,
  );
  t.assert(
    /cust__acme__work_orders/.test(result.stdout + result.stderr),
    'scanner output names the cust__ growth table',
  );
}

// ── Test 7: Fully-correct refresh_tokens index passes scanner ────────────────
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run migrations:check',
    fixturePath: 'migrations/instance/9999900000005-selftest-ok-refresh-tokens.ts',
    fixtureContent: [
      "import { MigrationInterface, QueryRunner } from 'typeorm';",
      '',
      'export class SelftestOkRefreshTokens9999900000005 implements MigrationInterface {',
      "  name = 'SelftestOkRefreshTokens9999900000005';",
      '  static transaction = false;',
      '',
      '  public async up(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(',
      '      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_refresh_tokens_selftest" ON "refresh_tokens" ("family_id")`,',
      '    );',
      '  }',
      '',
      '  public async down(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(',
      '      `DROP INDEX CONCURRENTLY IF EXISTS "idx_refresh_tokens_selftest"`,',
      '    );',
      '  }',
      '}',
    ].join('\n'),
  });
  t.assert(
    result.exitCode === 0,
    `compliant refresh_tokens migration passes scanner (got exit ${result.exitCode})`,
  );
}

// ── Test 8: Same-migration-table-creation exception (unqualified) ────────────
//   A migration that creates a growth table AND a blocking index on it in
//   the same DDL is allowed: the table is empty at index-build time so
//   ACCESS EXCLUSIVE contention is impossible. Pre-W2 baselines depend on
//   this exception.
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run migrations:check',
    fixturePath: 'migrations/instance/9999900000006-selftest-baseline-create-table-and-index.ts',
    fixtureContent: [
      "import { MigrationInterface, QueryRunner } from 'typeorm';",
      '',
      'export class SelftestBaselineCreateTableAndIndex9999900000006 implements MigrationInterface {',
      "  name = 'SelftestBaselineCreateTableAndIndex9999900000006';",
      '',
      '  public async up(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(`CREATE TABLE audit_logs (id uuid PRIMARY KEY, created_at timestamptz NOT NULL)`);',
      '    await queryRunner.query(`CREATE INDEX "idx_audit_logs_baseline" ON audit_logs (created_at)`);',
      '  }',
      '',
      '  public async down(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(`DROP TABLE audit_logs`);',
      '  }',
      '}',
    ].join('\n'),
  });
  t.assert(
    result.exitCode === 0,
    `same-migration table+index on growth table is allowed (got exit ${result.exitCode})`,
  );
  t.assert(
    /migrations:check: ok/.test(result.stdout + result.stderr),
    'scanner reports clean for same-migration table creation pattern',
  );
}

// ── Test 9: Schema-qualified blocking CREATE INDEX is now caught ─────────────
//   Pre-Task-3 regex captured only the FIRST identifier after ON, which for
//   `ON identity.refresh_tokens` was `identity` (schema name) — silently
//   passed because `identity` isn't a growth table. The fixed regex extracts
//   the table name regardless of schema qualification.
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run migrations:check',
    fixturePath: 'migrations/instance/9999900000007-selftest-schema-qualified-bad-index.ts',
    fixtureContent: [
      "import { MigrationInterface, QueryRunner } from 'typeorm';",
      '',
      'export class SelftestSchemaQualifiedBadIndex9999900000007 implements MigrationInterface {',
      "  name = 'SelftestSchemaQualifiedBadIndex9999900000007';",
      '',
      '  public async up(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(',
      '      `CREATE INDEX "idx_schema_qualified_selftest" ON identity.refresh_tokens (user_id)`,',
      '    );',
      '  }',
      '',
      '  public async down(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(`DROP INDEX IF EXISTS "idx_schema_qualified_selftest"`);',
      '  }',
      '}',
    ].join('\n'),
  });
  t.assert(
    result.exitCode !== 0,
    `schema-qualified blocking index on growth table fails scanner (got exit ${result.exitCode})`,
  );
  t.assert(
    /refresh_tokens/.test(result.stdout + result.stderr),
    'scanner output names the table (not the schema)',
  );
}

// ── Test 10: Same-migration exception works with schema-qualified refs ───────
//   Same as Test 8 but with `identity.audit_logs` — exercises both the
//   regex fix and the CREATE TABLE detector on schema-qualified names.
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run migrations:check',
    fixturePath: 'migrations/instance/9999900000008-selftest-schema-qualified-baseline.ts',
    fixtureContent: [
      "import { MigrationInterface, QueryRunner } from 'typeorm';",
      '',
      'export class SelftestSchemaQualifiedBaseline9999900000008 implements MigrationInterface {',
      "  name = 'SelftestSchemaQualifiedBaseline9999900000008';",
      '',
      '  public async up(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(`CREATE TABLE identity.audit_logs (id uuid PRIMARY KEY)`);',
      '    await queryRunner.query(`CREATE INDEX "idx_audit_logs_schema_baseline" ON identity.audit_logs (id)`);',
      '  }',
      '',
      '  public async down(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(`DROP TABLE identity.audit_logs`);',
      '  }',
      '}',
    ].join('\n'),
  });
  t.assert(
    result.exitCode === 0,
    `same-migration exception applies to schema-qualified refs (got exit ${result.exitCode})`,
  );
}

// ── Test 11: Same-migration exception does NOT cover Check 2 ─────────────────
//   A migration creates a growth table AND uses CONCURRENTLY on it but omits
//   `static transaction = false`. Still flagged: CONCURRENTLY can never run
//   inside a transaction regardless of when the table was created.
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run migrations:check',
    fixturePath: 'migrations/instance/9999900000009-selftest-concurrent-newtable-no-flag.ts',
    fixtureContent: [
      "import { MigrationInterface, QueryRunner } from 'typeorm';",
      '',
      'export class SelftestConcurrentNewTableNoFlag9999900000009 implements MigrationInterface {',
      "  name = 'SelftestConcurrentNewTableNoFlag9999900000009';",
      '  // transaction = false is intentionally absent here.',
      '',
      '  public async up(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(`CREATE TABLE audit_logs (id uuid PRIMARY KEY)`);',
      '    await queryRunner.query(',
      '      `CREATE INDEX CONCURRENTLY "idx_audit_logs_cnt_newtable" ON audit_logs (id)`,',
      '    );',
      '  }',
      '',
      '  public async down(queryRunner: QueryRunner): Promise<void> {',
      '    await queryRunner.query(`DROP TABLE audit_logs`);',
      '  }',
      '}',
    ].join('\n'),
  });
  t.assert(
    result.exitCode !== 0,
    `same-migration exception does NOT cover CONCURRENTLY-without-flag check (got exit ${result.exitCode})`,
  );
  t.assert(
    /transaction = false/.test(result.stdout + result.stderr),
    'scanner output still mentions the missing transaction = false',
  );
}

t.report();
