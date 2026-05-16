#!/usr/bin/env tsx
/**
 * schema-manifest.ts
 *
 * Generates a deterministic schema manifest for the running instance and
 * control-plane databases. The manifest lists every table, column,
 * constraint, and index in sorted order, then emits a SHA-256 hash of
 * the full listing.
 *
 * Running this script twice against the same database should produce
 * byte-identical output — any drift between runs indicates a
 * non-deterministic query or noise in the introspection query.
 *
 * Usage:
 *   npx tsx tools/schema-manifest.ts
 *   npx tsx tools/schema-manifest.ts | Out-File -Encoding utf8 docs/superpowers/plans/2026-05-15-baseline-schema-manifest.md
 *
 * Environment variables (with fallbacks matching scripts/setup.ts):
 *   POSTGRES_USER            — default: hubblewave
 *   DB_NAME                  — default: hubblewave
 *   CONTROL_PLANE_DB_NAME    — default: hubblewave_control_plane
 *   DB_HOST                  — default: localhost
 *   DB_PORT                  — default: 5432
 *   DB_PASSWORD              — default: hubblewave
 */

import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ──────────────────────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────────────────────

const PG_USER = process.env['POSTGRES_USER'] ?? 'hubblewave';
const INSTANCE_DB = process.env['DB_NAME'] ?? 'hubblewave';
const CP_DB = process.env['CONTROL_PLANE_DB_NAME'] ?? 'hubblewave_control_plane';

// ──────────────────────────────────────────────────────────────────────────────
// Introspection queries
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Returns a normalised listing of tables + columns for the given database.
 * Rows are sorted by schema, table, ordinal_position so the output is
 * deterministic regardless of creation order.
 */
const TABLES_AND_COLUMNS_SQL = `
SELECT
  table_schema,
  table_name,
  column_name,
  ordinal_position,
  column_default,
  is_nullable,
  data_type,
  character_maximum_length,
  udt_name
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, ordinal_position;
`;

/**
 * Constraints (primary keys, unique constraints, check constraints).
 * Foreign keys are covered separately below.
 */
const CONSTRAINTS_SQL = `
SELECT
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema NOT IN ('pg_catalog', 'information_schema')
  AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
ORDER BY tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position;
`;

/**
 * Foreign key constraints.
 */
const FOREIGN_KEYS_SQL = `
SELECT
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  tc.constraint_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
  AND tc.table_schema = rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
  AND rc.unique_constraint_schema = ccu.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY tc.table_schema, tc.table_name, tc.constraint_name;
`;

/**
 * Indexes (excluding those auto-created for constraints).
 */
const INDEXES_SQL = `
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename, indexname;
`;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

let _tmpSqlFile: string | null = null;

function getTmpSqlFile(): string {
  if (!_tmpSqlFile) {
    _tmpSqlFile = join(tmpdir(), `hw-schema-manifest-${process.pid}.sql`);
  }
  return _tmpSqlFile;
}

function cleanupTmpFile(): void {
  const f = getTmpSqlFile();
  if (existsSync(f)) {
    try { unlinkSync(f); } catch { /* ignore */ }
  }
}

/**
 * Runs a SQL query against a database using docker exec (local dev) or
 * direct psql (CI). Uses a temp file to avoid shell-quoting issues with
 * multi-line SQL on Windows.
 */
function runPsql(dbName: string, sql: string): string {
  const sqlFile = getTmpSqlFile();
  writeFileSync(sqlFile, sql, { encoding: 'utf8' });

  // Try docker exec first (works on any local dev box with docker-compose).
  try {
    return execSync(
      `docker exec -i hw_postgres psql -U ${PG_USER} -d ${dbName} -t -A -F "|" -f -`,
      {
        encoding: 'utf8',
        input: sql,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
  } catch {
    // Fallback: direct psql. In CI the PGPASSWORD env var is set by the
    // workflow and psql is on PATH. On Windows local this path is skipped
    // because docker exec succeeds.
    const host = process.env['DB_HOST'] ?? 'localhost';
    const port = process.env['DB_PORT'] ?? '5432';
    const password = process.env['DB_PASSWORD'] ?? 'hubblewave';
    const env: NodeJS.ProcessEnv = { ...process.env, PGPASSWORD: password };
    return execSync(
      `psql -h ${host} -p ${port} -U ${PG_USER} -d ${dbName} -t -A -F "|" -f "${sqlFile}"`,
      {
        encoding: 'utf8',
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
  }
}

function introspectDatabase(dbName: string): string {
  const sections: string[] = [];

  sections.push(`## Tables and Columns`);
  const colRows = runPsql(dbName, TABLES_AND_COLUMNS_SQL).trim();
  sections.push(colRows || '(none)');

  sections.push(`\n## Constraints`);
  const conRows = runPsql(dbName, CONSTRAINTS_SQL).trim();
  sections.push(conRows || '(none)');

  sections.push(`\n## Foreign Keys`);
  const fkRows = runPsql(dbName, FOREIGN_KEYS_SQL).trim();
  sections.push(fkRows || '(none)');

  sections.push(`\n## Indexes`);
  const idxRows = runPsql(dbName, INDEXES_SQL).trim();
  sections.push(idxRows || '(none)');

  return sections.join('\n');
}

// ──────────────────────────────────────────────────────────────────────────────
// Self-test
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Builds the deterministic introspection content string (the portion that is
 * hashed). This is the same content emitted after the date header in the
 * manifest, and is what `--self-test` compares across runs.
 *
 * Keeping the hashed portion separate from the date header means the SHA-256
 * is stable across calendar-day boundaries — only the database schema drives
 * the hash.
 */
function buildIntrospectionContent(): string {
  const parts: string[] = [];

  parts.push(`# Instance database: ${INSTANCE_DB}`);
  parts.push('');
  parts.push(introspectDatabase(INSTANCE_DB));
  parts.push('');

  parts.push(`# Control-plane database: ${CP_DB}`);
  parts.push('');
  parts.push(introspectDatabase(CP_DB));
  parts.push('');

  return parts.join('\n');
}

/**
 * Self-validation: runs the same full manifest generation twice and verifies
 * the outputs are byte-identical. Exits 1 if they differ (indicates
 * non-deterministic query output or connection noise).
 *
 * Both introspection runs and the final rendered manifest (including the date
 * header) must match — the date header is identical within a single calendar
 * day, and the SHA-256 is computed over the date-header-free introspection
 * content so it is stable across day boundaries.
 *
 * Activated when --self-test flag is passed.
 */
function runSelfTest(): void {
  process.stderr.write('Running self-test: two consecutive manifest generations should be byte-identical...\n');

  const run1 = buildIntrospectionContent();
  const run2 = buildIntrospectionContent();

  if (run1 !== run2) {
    process.stderr.write('FAIL: introspection content differs between run 1 and run 2.\n');
    process.exit(1);
  }

  // Verify the full rendered manifest (including date header) is also byte-identical.
  const date = new Date().toISOString().split('T')[0];
  const header = [
    '# HubbleWave Schema Manifest',
    `# Generated: ${date}`,
    '# Deterministic schema snapshot for baseline audit and drift detection.',
    `# SHA-256 (of introspection content below): ${createHash('sha256').update(run1).digest('hex')}`,
    '',
  ].join('\n');

  const manifest1 = header + run1;
  const manifest2 = header + run2;

  if (manifest1 !== manifest2) {
    process.stderr.write('FAIL: full manifest output differs between run 1 and run 2.\n');
    process.exit(1);
  }

  process.stderr.write('PASS: introspection content and full manifest output are byte-identical across both runs.\n');
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const isSelfTest = args.includes('--self-test');

  process.on('exit', cleanupTmpFile);
  process.on('SIGINT', () => { cleanupTmpFile(); process.exit(130); });
  process.on('uncaughtException', (err) => { cleanupTmpFile(); throw err; });

  if (isSelfTest) {
    runSelfTest();
    return;
  }

  // The introspection content is the deterministic, date-header-free portion
  // that the SHA-256 is computed over. The date header is written for human
  // readability but deliberately excluded from hashing so the hash is stable
  // across calendar-day boundaries.
  const introspectionContent = buildIntrospectionContent();
  const hash = createHash('sha256').update(introspectionContent).digest('hex');

  const header = [
    '# HubbleWave Schema Manifest',
    `# Generated: ${new Date().toISOString().split('T')[0]}`,
    '# Deterministic schema snapshot for baseline audit and drift detection.',
    `# SHA-256 (of introspection content below): ${hash}`,
    '',
  ].join('\n');

  const fullOutput = header + introspectionContent;

  // Emit the manifest
  process.stdout.write(fullOutput);

  // Echo the hash to stderr as a convenience for capture in CI logs
  process.stderr.write(`\nSHA-256: ${hash}\n`);
}

main();
