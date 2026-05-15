#!/usr/bin/env tsx
/**
 * migration-filename-check
 *
 * Verifies every file under `migrations/` follows the standardized
 * filename convention: `<14-digit-timestamp>-<kebab-case-name>.ts`.
 *
 * Forbidden filename tokens (anywhere in the kebab-case name):
 *   temp, fix, final, final-final, retry, smoke, wip, draft
 *
 * Spec test files (*.spec.ts) are excluded.
 *
 * Pre-existing committed migrations that predate the naming convention
 * can be listed in the allowlist file (default:
 * tools/scanners/migration-filename-allowlist.json). Each entry uses the
 * shared allowlist-schema.json single-identifier form with `target` set
 * to the file path relative to the repo root OR the bare basename.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const FORBIDDEN_TOKENS = ['temp', 'fix', 'final', 'final-final', 'retry', 'smoke', 'wip', 'draft'];
const VALID_RE = /^\d{13,14}-[a-z0-9]+(?:-[a-z0-9]+)*\.ts$/;

interface AllowlistEntry {
  target: string;
  rationale: string;
  addedBy: string;
  addedAt: string;
  followUp?: string;
}

interface Allowlist {
  entries: AllowlistEntry[];
}

function parseArgs(argv: string[]): { root: string; ci: boolean; allowlist: string } {
  let root = 'migrations';
  let ci = false;
  let allowlist = 'tools/scanners/migration-filename-allowlist.json';
  for (const arg of argv) {
    if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
    else if (arg === '--ci') ci = true;
    else if (arg.startsWith('--allowlist=')) allowlist = arg.slice('--allowlist='.length);
  }
  return { root, ci, allowlist };
}

function collect(dir: string): string[] {
  const out: string[] = [];
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      out.push(...collect(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function loadAllowlist(path: string): Set<string> {
  let raw: Allowlist = { entries: [] };
  try {
    raw = JSON.parse(readFileSync(path, 'utf8')) as Allowlist;
  } catch {
    // Missing or unreadable allowlist file is treated as empty — not an error.
  }
  return new Set(raw.entries.map((e) => e.target));
}

function main() {
  const { root, ci, allowlist: allowlistPath } = parseArgs(process.argv.slice(2));
  const allowedTargets = loadAllowlist(allowlistPath);

  const files = collect(root).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
  const violations: { file: string; reason: string }[] = [];
  for (const file of files) {
    const basename = file.split(/[\\/]/).pop() ?? '';

    // Normalize path separators for cross-platform allowlist matching.
    const normalizedFile = file.replace(/\\/g, '/');

    if (allowedTargets.has(normalizedFile) || allowedTargets.has(basename)) continue;

    if (!VALID_RE.test(basename)) {
      violations.push({ file, reason: `does not match pattern <14-digit-timestamp>-<kebab-case-name>.ts` });
    }
    const lower = basename.toLowerCase();
    for (const tok of FORBIDDEN_TOKENS) {
      if (lower.includes(`-${tok}-`) || lower.endsWith(`-${tok}.ts`)) {
        violations.push({ file, reason: `contains forbidden token '${tok}'` });
      }
    }
  }
  if (ci) console.log(JSON.stringify({ violations, total: violations.length }));
  else if (violations.length > 0) {
    console.log(`\nMigration filename violations (${violations.length}):`);
    for (const v of violations) console.log(`  ${v.file} — ${v.reason}`);
  } else console.log('migration-filename-check: 0 violations');
  process.exit(violations.length > 0 ? 1 : 0);
}

main();
