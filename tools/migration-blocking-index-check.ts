#!/usr/bin/env ts-node
/**
 * Static-analysis check for canon §15 (speed never justifies decay) and
 * §17 (modular monolith performance posture).
 *
 * Flags migrations that CREATE INDEX on growth tables WITHOUT using
 * `CREATE INDEX CONCURRENTLY`. On multi-GB tables (audit_logs,
 * collection_records, etc.) a blocking CREATE INDEX takes an
 * ACCESS EXCLUSIVE lock for the full build duration — unacceptable
 * on a live customer instance.
 *
 * Rule (binding on future migrations; legacy inventory tracked separately):
 *   - If a migration creates an index on a GROWTH TABLE it MUST use
 *     `CREATE INDEX CONCURRENTLY` AND the migration class MUST declare
 *     `static transaction = false` (CONCURRENTLY cannot run inside a
 *     transaction).
 *   - If the table is NOT a growth table, blocking CREATE INDEX is
 *     acceptable (reference / config tables are bounded in size).
 *   - EXCEPTION (Pre-W2): If the migration ALSO creates the growth table
 *     in its own DDL via `CREATE TABLE`, blocking CREATE INDEX on it is
 *     allowed. The table is empty at index-build time, so ACCESS EXCLUSIVE
 *     contention is impossible. Squash baselines and fresh-install seeds
 *     all match this pattern. The exception applies only to Check 1
 *     (blocking vs CONCURRENTLY); Check 2 (`static transaction = false`
 *     when CONCURRENTLY is used) is independent of when the table was
 *     created — CONCURRENTLY can never run inside a transaction.
 *
 * Growth tables (configurable GROWTH_TABLE_PATTERNS below):
 *   audit_logs, collection_records, automation_execution_logs,
 *   data_records, pack_install_logs, refresh_tokens, and any per-customer
 *   collection storage table prefixed `cust__`.
 *
 * Pre-existing (legacy) migration files that violate the rule are tracked
 * in LEGACY_ALLOWLIST below. Each entry requires a rationale. Adding a
 * NEW entry to this allowlist is forbidden — only existing migrations
 * (already shipped to customer instances) may be listed here. The
 * same-migration-table-creation exception above subsumes several existing
 * entries; Task 4 (incremental-migration deletion) is the natural place
 * to shrink the allowlist once the entries' underlying files are removed.
 *
 * Refs: F046, W6.A, Plan Fix 26 — performance wave.
 *       Phase 3 W2 Task 3 — Pre-W2 baseline scanner exception.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const MIGRATION_DIRS = [
  join(process.cwd(), 'migrations', 'instance'),
  join(process.cwd(), 'migrations', 'control-plane'),
];

/**
 * Tables expected to grow to multi-GB on live customer instances.
 * Indexes on these tables MUST use CONCURRENTLY.
 *
 * String entries are exact table names (case-sensitive, unquoted).
 * Prefix entries end with `*` and match any table whose name starts
 * with the given prefix.
 */
const GROWTH_TABLE_PATTERNS: string[] = [
  'audit_logs',
  'collection_records',
  'automation_execution_logs',
  'data_records',
  'pack_install_logs',
  'refresh_tokens',
  'cust__*',
];

/**
 * Pre-existing migration files that were written before the CONCURRENTLY
 * convention landed (W6.A). Empty as of Phase 3 W2 Task 4 — the six prior
 * entries pointed at the 98 instance + 8 control-plane incremental
 * migrations that were squashed into the Pre-W2 baseline (archived at the
 * `pre-w2-migration-archive` git tag) and deleted from the tree. Three of
 * those entries (initial schema, automation-tables, add-refresh-token-
 * families) were same-migration-table-creation patterns that the Task 3
 * exception subsumes anyway; the other three (audit-log-hash-chain,
 * audit-log-permission, control-plane refresh_tokens) were genuine pre-
 * convention violations the squash retires.
 *
 * ADDING A NEW ENTRY IS FORBIDDEN. All new migrations must comply with
 * CONCURRENTLY + `static transaction = false`, or fall under the
 * same-migration-table-creation exception (squash baselines, fresh-install
 * seeds). The empty literal stays as the structural anchor — when the
 * next genuine pre-existing-violation case is identified, it lands here
 * with rationale + reviewer commitment, not as a silent regex narrowing.
 */
const LEGACY_ALLOWLIST: Array<{
  /** Relative file path from repo root (forward slashes). */
  file: string;
  /** Why this pre-existing violation is accepted. */
  rationale: string;
}> = [];

// ─────────────────────────────────────────────────────────────────────────────
// Regexes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Matches a blocking CREATE INDEX statement — i.e., CREATE INDEX (optionally
 * UNIQUE) that is NOT immediately followed by the word CONCURRENTLY.
 *
 * Captures the ON clause's table name. Accepts unqualified (`ON tablename`),
 * quoted (`ON "tablename"`), or schema-qualified (`ON schema.tablename` /
 * `ON "schema"."tablename"`) references — capturing just the table name in
 * the named group. The optional `(?:ONLY\s+)?` accepts `CREATE INDEX ... ON
 * ONLY <table>` (PG partition-table syntax).
 *
 * Uses `[\s\S]*?` (lazy) so it matches across lines without crossing to
 * a second CREATE INDEX statement on the same file. The negative lookahead
 * `(?!\s+CONCURRENTLY)` ensures `CREATE INDEX CONCURRENTLY` is skipped.
 */
const BLOCKING_CREATE_INDEX_RE =
  /CREATE\s+(?:UNIQUE\s+)?INDEX\b(?!\s+CONCURRENTLY)([\s\S]*?)ON\s+(?:ONLY\s+)?(?:"?\w+"?\.)?"?(\w+)"?/gi;

/**
 * Detects the presence of `static transaction = false` (with or without
 * `public`, `readonly`, or type annotation variants TypeORM supports).
 */
const TRANSACTION_FALSE_RE = /static\s+transaction\s*=\s*false/;

/**
 * Matches a CREATE TABLE statement and captures the table name. Accepts
 * `IF NOT EXISTS`, schema-qualified or unqualified table names, quoted or
 * unquoted identifiers. Used to build the set of tables created in a
 * migration for the same-migration exception (see file header).
 *
 * Does NOT match `CREATE TEMP TABLE`, `CREATE UNLOGGED TABLE`, etc. — those
 * aren't growth tables that need protection.
 */
const CREATE_TABLE_RE =
  /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?\w+"?\.)?"?(\w+)"?/gi;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isGrowthTable(tableName: string): boolean {
  const lower = tableName.toLowerCase();
  for (const pattern of GROWTH_TABLE_PATTERNS) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1).toLowerCase();
      if (lower.startsWith(prefix)) return true;
    } else {
      if (lower === pattern.toLowerCase()) return true;
    }
  }
  return false;
}

function relPath(absolute: string): string {
  return absolute
    .replace(process.cwd() + '\\', '')
    .replace(process.cwd() + '/', '')
    .replace(/\\/g, '/');
}

function isLegacyAllowlisted(filePath: string): boolean {
  const rel = relPath(filePath);
  return LEGACY_ALLOWLIST.some((entry) => entry.file === rel);
}

/**
 * Returns the set of table names this migration creates via CREATE TABLE,
 * normalized to lowercase + schema-stripped. Used to apply the
 * same-migration-table-creation exception in Check 1.
 */
function tablesCreatedInMigration(content: string): Set<string> {
  const created = new Set<string>();
  const re = new RegExp(CREATE_TABLE_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m[1]) created.add(m[1].toLowerCase());
  }
  return created;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Violation = {
  file: string;
  reason: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Scanner
// ─────────────────────────────────────────────────────────────────────────────

function analyzeFile(filePath: string): Violation[] {
  if (isLegacyAllowlisted(filePath)) {
    return [];
  }

  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const violations: Violation[] = [];
  const createdHere = tablesCreatedInMigration(content);

  // ── Check 1: blocking CREATE INDEX on a growth table ──────────────────────
  const createRe = new RegExp(BLOCKING_CREATE_INDEX_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = createRe.exec(content)) !== null) {
    // Group 1 = the content between INDEX and ON (not used for table name).
    // Group 2 = the table name captured after ON [schema.]table.
    const rawTable = m[2];
    if (!rawTable) continue;
    if (!isGrowthTable(rawTable)) continue;
    // Same-migration-table-creation exception: empty-at-index-build-time
    // means no ACCESS EXCLUSIVE contention possible.
    if (createdHere.has(rawTable.toLowerCase())) continue;

    const hasTransactionFalse = TRANSACTION_FALSE_RE.test(content);

    violations.push({
      file: filePath,
      reason:
        `Blocking CREATE INDEX on growth table "${rawTable}". ` +
        `Use CREATE INDEX CONCURRENTLY` +
        (hasTransactionFalse
          ? ` (transaction = false is present, but CONCURRENTLY is missing).`
          : ` and add \`static transaction = false\` to the migration class.`),
    });
    // Report once per file — the fix is the same regardless of index count.
    break;
  }

  if (violations.length > 0) return violations;

  // ── Check 2: CONCURRENTLY used but transaction = false is absent ──────────
  //    Only applies if the file has CREATE INDEX CONCURRENTLY on a growth table.
  //    The same-migration-table-creation exception does NOT apply here:
  //    CONCURRENTLY can never run inside a transaction regardless of when the
  //    target table was created.
  const concurrentRe =
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b([\s\S]*?)ON\s+(?:ONLY\s+)?(?:"?\w+"?\.)?"?(\w+)"?/gi;
  while ((m = concurrentRe.exec(content)) !== null) {
    const rawTable = m[2];
    if (!rawTable) continue;
    if (!isGrowthTable(rawTable)) continue;

    const hasTransactionFalse = TRANSACTION_FALSE_RE.test(content);
    if (!hasTransactionFalse) {
      violations.push({
        file: filePath,
        reason:
          `Migration uses CREATE INDEX CONCURRENTLY on growth table "${rawTable}" ` +
          `but does not declare \`static transaction = false\`. ` +
          `CONCURRENTLY cannot run inside a transaction — add the static property.`,
      });
      break;
    }
  }

  return violations;
}

function scanDirectory(dir: string): Violation[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const violations: Violation[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.ts')) continue;
    const fullPath = join(dir, entry);
    let stats;
    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }
    if (!stats.isFile()) continue;
    violations.push(...analyzeFile(fullPath));
  }
  return violations;
}

function main(): void {
  const allViolations: Violation[] = [];
  for (const dir of MIGRATION_DIRS) {
    allViolations.push(...scanDirectory(dir));
  }

  if (allViolations.length === 0) {
    console.log('migrations:check: ok');
    console.log(
      '  All migrations comply with the CREATE INDEX CONCURRENTLY convention',
    );
    console.log(
      '  (growth tables: ' + GROWTH_TABLE_PATTERNS.join(', ') + ')',
    );
    if (LEGACY_ALLOWLIST.length > 0) {
      console.log(
        `  (${LEGACY_ALLOWLIST.length} legacy migration(s) acknowledged — see LEGACY_ALLOWLIST in scanner)`,
      );
    }
    return;
  }

  console.error('migrations:check failed');
  console.error('');
  console.error(
    'The following migrations create indexes on growth tables using blocking',
  );
  console.error(
    'CREATE INDEX syntax. On multi-GB tables this takes an ACCESS EXCLUSIVE',
  );
  console.error(
    'lock for the full build duration and blocks all writes on a live instance.',
  );
  console.error('');
  console.error('Fix: use CREATE INDEX CONCURRENTLY and add');
  console.error('  static transaction = false;');
  console.error(
    'to the migration class (CONCURRENTLY cannot run inside a transaction).',
  );
  console.error('');
  console.error('See libs/instance-db/src/lib/migrations/utils/concurrent-index.ts');
  console.error('for helper functions. Refs F046, W6.A, Plan Fix 26.');
  console.error('');

  for (const v of allViolations) {
    console.error(`  ${relPath(v.file)}`);
    console.error(`    ${v.reason}`);
  }

  process.exit(1);
}

main();
