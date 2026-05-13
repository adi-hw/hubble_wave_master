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
 *
 * Growth tables (configurable GROWTH_TABLE_PATTERNS below):
 *   audit_logs, collection_records, automation_execution_logs,
 *   data_records, pack_install_logs, refresh_tokens, and any per-customer
 *   collection storage table prefixed `cust__`.
 *
 * Pre-existing (legacy) migration files that violate the rule are tracked
 * in LEGACY_ALLOWLIST below. Each entry requires a rationale. Adding a
 * NEW entry to this allowlist is forbidden — only existing migrations
 * (already shipped to customer instances) may be listed here.
 *
 * Refs: F046, W6.A, Plan Fix 26 — performance wave.
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
 * convention landed (W6.A). These files MUST NOT be modified — migrations
 * are immutable once shipped. They are inventoried here so the scanner
 * reports them as acknowledged rather than failing CI.
 *
 * ADDING A NEW ENTRY IS FORBIDDEN. This list is append-only for historical
 * migrations. All new migrations on growth tables must comply.
 *
 * Full inventory documented in docs/plan-fixes/26-performance-wave.md.
 */
const LEGACY_ALLOWLIST: Array<{
  /** Relative file path from repo root (forward slashes). */
  file: string;
  /** Why this pre-existing violation is accepted. */
  rationale: string;
}> = [
  {
    file: 'migrations/instance/1766696011515-InitialSchema.ts',
    rationale:
      'Initial schema migration — ran on empty database at platform bootstrap. ' +
      'Tables were empty; no lock contention possible. Pre-pilot, pre-W6.A.',
  },
  {
    file: 'migrations/instance/1803000000000-phase3-automation-tables.ts',
    rationale:
      'Creates automation_execution_logs table and its initial indexes in one ' +
      'transaction (table + indexes together). Table did not exist before this ' +
      'migration ran, so no ACCESS EXCLUSIVE contention on existing data. Pre-W6.A.',
  },
  {
    file: 'migrations/instance/1820000000001-audit-log-hash-chain.ts',
    rationale:
      'Adds hash-chain columns and indexes on audit_logs. Ran at pre-pilot ' +
      'stage when audit_logs table had bounded rows. Pre-W6.A.',
  },
  {
    file: 'migrations/instance/1830000000000-audit-log-permission.ts',
    rationale:
      'Adds permission_code+created_at composite index on audit_logs. ' +
      'Pre-pilot instance; table had bounded rows at migration time. Pre-W6.A.',
  },
  {
    file: 'migrations/instance/1930600000000-add-refresh-token-families.ts',
    rationale:
      'Drops and recreates refresh_tokens table (full table rebuild per canon §1 ' +
      'greenfield posture). New indexes are on a freshly-created empty table — ' +
      'no CONCURRENTLY benefit for a new table. Pre-W6.A; table-rebuild context.',
  },
  {
    file: 'migrations/control-plane/1824000000000-refresh-tokens.ts',
    rationale:
      'Control-plane refresh_tokens. Table has bounded growth (only HubbleWave ' +
      'operator accounts; not per-customer). Blocking index acceptable at this scale. ' +
      'Pre-W6.A.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Regexes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Matches a blocking CREATE INDEX statement — i.e., CREATE INDEX (optionally
 * UNIQUE) that is NOT immediately followed by the word CONCURRENTLY.
 *
 * Captures the ON "tableName" / ON tableName clause so we can check
 * whether the table is a growth table.
 *
 * Uses `[\s\S]*?` (lazy) so it matches across lines without crossing to
 * a second CREATE INDEX statement on the same file. The negative lookahead
 * `(?!\s+CONCURRENTLY)` ensures `CREATE INDEX CONCURRENTLY` is skipped.
 */
const BLOCKING_CREATE_INDEX_RE =
  /CREATE\s+(?:UNIQUE\s+)?INDEX\b(?!\s+CONCURRENTLY)([\s\S]*?)ON\s+"?(\w+)"?/gi;

/**
 * Detects the presence of `static transaction = false` (with or without
 * `public`, `readonly`, or type annotation variants TypeORM supports).
 */
const TRANSACTION_FALSE_RE = /static\s+transaction\s*=\s*false/;

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

  // ── Check 1: blocking CREATE INDEX on a growth table ──────────────────────
  const createRe = new RegExp(BLOCKING_CREATE_INDEX_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = createRe.exec(content)) !== null) {
    // Group 1 = the content between INDEX and ON (not used for table name).
    // Group 2 = the table name captured after ON "tableName".
    const rawTable = m[2];
    if (!rawTable) continue;
    if (!isGrowthTable(rawTable)) continue;

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
  const concurrentRe =
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b([\s\S]*?)ON\s+"?(\w+)"?/gi;
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
