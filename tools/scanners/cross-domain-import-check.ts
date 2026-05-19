#!/usr/bin/env tsx
/**
 * cross-domain-import-check
 *
 * Verifies that entities in one domain do not import entities from another
 * domain outside an explicit allowlist. Logical identifiers
 * `<domain>.<entity-name>` (kebab-cased class name) are used in the allowlist
 * so refactors do not invalidate entries.
 *
 * Domain comes from `@Entity({ schema: '...' })`. Entity-name is the
 * kebab-cased class name (e.g. `UserRole` → `user-role`). Tables in the
 * `public` schema (or with no explicit schema) are assigned domain `public`.
 *
 * Caveat: heuristic / static-text-based (regex over *.entity.ts files).
 * Sufficient for the Phase 3 Prelude exit criterion. Multi-line @Entity()
 * is handled via `[\s\S]*?` patterns. Future waves may replace with
 * AST-based parsing (ts-morph) if false positives or negatives emerge.
 *
 * Known limitations (heuristic scanner — see spec at
 * docs/superpowers/specs/2026-05-14-phase3-roadmap-and-prelude-design.md
 * Stream 1 caveat):
 *   - Imports that route through barrel index files (e.g.,
 *     `import { User } from '../entities'` → `entities/index.ts`) are
 *     silently skipped. Entity files SHOULD import each other via direct
 *     paths (`./user.entity`, `../identity/role.entity`). The scanner
 *     does not follow re-exports.
 *   - Suffix matching on `.entity.ts` is case-sensitive; entities authored
 *     on case-insensitive filesystems with non-standard casing may be
 *     missed.
 *   - Class-name kebab conversion assumes CamelCase discipline; acronyms
 *     like `HTTPServer` produce `h-t-t-p-server` — choose class names
 *     accordingly for stable logical IDs.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';

/**
 * Per-plane manifest shape (W2 follow-up round 3). Pre-round-3 the
 * manifest was a flat `{ [schema]: tables[] }` map; round 3 wrapped it
 * under `instance` and added a `controlPlane` sibling so the entity-
 * schema scanner could validate both planes against the schemas they
 * actually use. Cross-domain import-check operates on the INSTANCE
 * plane only — control-plane entities live in a separate
 * `libs/control-plane-db/` tree that is its own dependency graph
 * (canon §17, §18) and cross-domain rules don't apply to it.
 *
 * Loader below supports both shapes: a manifest with a top-level
 * `instance` key is treated as the new per-plane form (instance
 * section is used); a manifest without it is treated as the legacy
 * flat form.
 */
interface PerPlaneManifest {
  _version?: number;
  $comment?: string;
  instance?: { [schema: string]: string[] };
  controlPlane?: { [schema: string]: string[] };
}
interface FlatManifest { [schema: string]: string[] }
type Manifest = FlatManifest;

function loadManifest(path: string): Manifest {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as PerPlaneManifest | FlatManifest;
  if (raw && typeof raw === 'object' && 'instance' in raw && raw.instance) {
    return raw.instance as Manifest;
  }
  // Filter out any non-array top-level keys ($comment / _version / etc.).
  const flat = raw as FlatManifest & Record<string, unknown>;
  const out: Manifest = {};
  for (const [k, v] of Object.entries(flat)) {
    if (Array.isArray(v)) out[k] = v as string[];
  }
  return out;
}
interface AllowlistEntry { from: string; to: string; rationale: string; addedBy: string; addedAt: string }
interface Allowlist { entries: AllowlistEntry[] }

function parseArgs(argv: string[]): { root: string; manifest: string; allowlist: string; ci: boolean } {
  let root = '.';
  let manifest = 'tools/scanners/entity-schema-manifest.json';
  let allowlist = 'tools/scanners/cross-domain-allowlist.json';
  let ci = false;
  for (const arg of argv) {
    if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
    else if (arg.startsWith('--manifest=')) manifest = arg.slice('--manifest='.length);
    else if (arg.startsWith('--allowlist=')) allowlist = arg.slice('--allowlist='.length);
    else if (arg === '--ci') ci = true;
  }
  return { root, manifest, allowlist, ci };
}

function findEntityFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry);
      let stat; try { stat = statSync(full); } catch { continue; }
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry === '.claude') continue;
        walk(full);
      } else if (entry.endsWith('.entity.ts')) out.push(full);
    }
  }
  walk(root);
  return out;
}

function kebab(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

interface FileMeta { file: string; domain: string; logicalId: string }

function entityMeta(file: string, tableToSchema: Map<string, string>): FileMeta | null {
  let src: string;
  try { src = readFileSync(file, 'utf8'); } catch { return null; }
  const entityRe = /@Entity\(\s*(?:'([^']+)'|\{\s*name:\s*'([^']+)'(?:\s*,\s*schema:\s*'([^']+)')?[\s\S]*?\})\s*\)/;
  const classRe = /export\s+class\s+(\w+)/;
  const em = entityRe.exec(src);
  const cm = classRe.exec(src);
  if (!em || !cm) return null;
  const table = em[1] ?? em[2];
  const domain = em[3] ?? tableToSchema.get(table ?? '') ?? 'public';
  return { file, domain, logicalId: `${domain}.${kebab(cm[1])}` };
}

function extractImports(file: string): { path: string; line: number }[] {
  const src = readFileSync(file, 'utf8');
  const out: { path: string; line: number }[] = [];
  const re = /import\s+(?:[^'"`]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const line = src.slice(0, m.index).split('\n').length;
    out.push({ path: m[1], line });
  }
  return out;
}

function main() {
  const { root, manifest: manifestPath, allowlist: allowlistPath, ci } = parseArgs(process.argv.slice(2));
  const manifest: Manifest = loadManifest(manifestPath);
  const tableToSchema = new Map<string, string>();
  for (const [s, ts] of Object.entries(manifest)) for (const t of ts) tableToSchema.set(t, s);
  const allowlist: Allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  const allowedPairs = new Set(allowlist.entries.map((e) => `${e.from}->${e.to}`));

  const files = findEntityFiles(root);
  const violations: { from: string; to: string; fromFile: string; toFile: string; line: number }[] = [];

  for (const file of files) {
    const fromMeta = entityMeta(file, tableToSchema);
    if (!fromMeta) continue;
    for (const imp of extractImports(file)) {
      if (!imp.path.startsWith('.')) continue;
      const resolved = resolve(dirname(file), imp.path);
      // Import paths may already include the `.entity` suffix (e.g. `./foo.entity`)
      // or omit it (e.g. `./foo`). Normalise to the `.entity.ts` filename on disk.
      const candidate = resolved.endsWith('.entity.ts')
        ? resolved
        : resolved.endsWith('.entity')
          ? `${resolved}.ts`
          : `${resolved}.entity.ts`;
      let toMeta: FileMeta | null;
      try { toMeta = entityMeta(candidate, tableToSchema); } catch { continue; }
      if (!toMeta || toMeta.domain === fromMeta.domain) continue;
      if (allowedPairs.has(`${fromMeta.logicalId}->${toMeta.logicalId}`)) continue;
      violations.push({ from: fromMeta.logicalId, to: toMeta.logicalId, fromFile: file, toFile: candidate, line: imp.line });
    }
  }

  if (ci) {
    console.log(JSON.stringify({ violations, total: violations.length }));
  } else if (violations.length > 0) {
    console.log(`\nCross-domain entity import violations (${violations.length}):\n`);
    for (const v of violations) {
      console.log(`  ${v.fromFile}:${v.line}`);
      console.log(`    ${v.from}  →  ${v.to}`);
    }
  } else {
    console.log('cross-domain-import-check: 0 violations');
  }
  process.exit(violations.length > 0 ? 1 : 0);
}

main();
