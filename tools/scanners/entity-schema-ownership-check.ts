#!/usr/bin/env tsx
/**
 * entity-schema-ownership-check
 *
 * Verifies every `@Entity()` declaration matches the schema assigned to its
 * table by the schema-split migrations (1940*-1942*). The manifest at
 * `tools/scanners/entity-schema-manifest.json` is the source of truth.
 *
 * Failures:
 *   - Entity for a table in a domain schema declares no schema (bare `@Entity('x')`)
 *   - Entity declares a different schema than the manifest assigns
 *
 * Passes:
 *   - Entity declares the correct schema explicitly
 *   - Entity for a `public`-schema table declares no schema (public is TypeORM default)
 *
 * Caveat: heuristic / static-text-based (regex over *.entity.ts files).
 * Sufficient for the Prelude exit criterion. May miss TS computed property
 * names, conditional @Entity() calls, or odd whitespace patterns. Future
 * waves may replace with AST-based parsing (ts-morph) if false positives or
 * negatives become operationally significant.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface Manifest { [schema: string]: string[] }

function parseArgs(argv: string[]): { root: string; manifest: string; ci: boolean } {
  let root = '.';
  let manifest = 'tools/scanners/entity-schema-manifest.json';
  let ci = false;
  for (const arg of argv) {
    if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
    else if (arg.startsWith('--manifest=')) manifest = arg.slice('--manifest='.length);
    else if (arg === '--ci') ci = true;
  }
  return { root, manifest, ci };
}

/**
 * Paths whose `.entity.ts` files describe NON-instance-plane entities and
 * therefore must not be validated against the instance-plane manifest.
 * The scanner's manifest at `tools/scanners/entity-schema-manifest.json`
 * is the schema-split contract for the instance DB only (canon §17
 * modular monolith → `apps/api`). Other planes have their own DBs and
 * their own schema models:
 *
 *   - `libs/control-plane-db/` — control-plane DB (canon §18 — traditional
 *     multi-tenant SaaS admin app, not subject to the instance schema
 *     split). Entities live in `public` and would collide with instance-
 *     plane entries of the same table name (e.g. `refresh_tokens`, which
 *     appears in both planes — `identity.refresh_tokens` on the instance
 *     DB and `public.refresh_tokens` on the control-plane DB).
 *
 * A future fix can replace this with a per-plane manifest section
 * (`{ instance: {...}, controlPlane: {...} }`) when there are enough
 * planes to justify the structural change. Today's two-plane reality
 * is cheaper to express as a path skip.
 */
const SKIP_PATH_FRAGMENTS = [
  // Cross-platform: match both forward-slash + backslash separators so
  // the scanner works on Windows and POSIX without a shell-side
  // normalisation step.
  'libs/control-plane-db',
  'libs\\control-plane-db',
];

function shouldSkipPath(file: string): boolean {
  return SKIP_PATH_FRAGMENTS.some((fragment) => file.includes(fragment));
}

function findEntityFiles(root: string): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry);
      let stat;
      try { stat = statSync(full); } catch { continue; }
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry === '.claude') continue;
        walk(full);
      } else if (entry.endsWith('.entity.ts')) {
        if (shouldSkipPath(full)) continue;
        results.push(full);
      }
    }
  }
  walk(root);
  return results;
}

interface EntityDecl { file: string; tableName: string; declaredSchema?: string }

function extractEntities(file: string): EntityDecl[] {
  const src = readFileSync(file, 'utf8');
  const results: EntityDecl[] = [];
  const re = /@Entity\(\s*(?:'([^']+)'|\{\s*name:\s*'([^']+)'(?:\s*,\s*schema:\s*'([^']+)')?[\s\S]*?\})\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const tableName = m[1] ?? m[2];
    const declaredSchema = m[3];
    results.push({ file, tableName, declaredSchema });
  }
  return results;
}

function main() {
  const { root, manifest: manifestPath, ci } = parseArgs(process.argv.slice(2));
  const manifest: Manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const tableToSchema = new Map<string, string>();
  for (const [schema, tables] of Object.entries(manifest)) {
    for (const t of tables) tableToSchema.set(t, schema);
  }
  const files = findEntityFiles(root);
  const violations: { file: string; tableName: string; expected: string; declared: string | undefined }[] = [];
  for (const file of files) {
    for (const decl of extractEntities(file)) {
      const expected = tableToSchema.get(decl.tableName);
      if (!expected) continue;
      if (expected === 'public') {
        if (decl.declaredSchema && decl.declaredSchema !== 'public') {
          violations.push({ file: decl.file, tableName: decl.tableName, expected, declared: decl.declaredSchema });
        }
      } else {
        if (decl.declaredSchema !== expected) {
          violations.push({ file: decl.file, tableName: decl.tableName, expected, declared: decl.declaredSchema });
        }
      }
    }
  }
  if (ci) {
    console.log(JSON.stringify({ violations, total: violations.length }));
  } else if (violations.length > 0) {
    console.log(`\nEntity schema ownership violations (${violations.length}):\n`);
    for (const v of violations) {
      console.log(`  ${v.file}`);
      console.log(`    table '${v.tableName}' → expected schema '${v.expected}', declared '${v.declared ?? '(none)'}'`);
    }
  } else {
    console.log('entity-schema-ownership-check: 0 violations');
  }
  process.exit(violations.length > 0 ? 1 : 0);
}

main();
