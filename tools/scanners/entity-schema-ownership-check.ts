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

/**
 * Plane the scanner is currently asserting against. Each plane owns a
 * separate database; entities live in disjoint schema sets per plane.
 *
 *   - `instance` — the customer-facing Nest API (`apps/api`) per canon
 *     §17. Schemas: app_builder, automation, ava, identity, insights,
 *     integrations, metadata, notify, plus `public` for tables that
 *     intentionally aren't schema-namespaced.
 *   - `controlPlane` — the HubbleWave-internal admin app
 *     (`apps/control-plane`) per canon §18. Single `public` schema by
 *     design (no schema split — it's a traditional multi-tenant SaaS
 *     admin surface, not the instance-plane modular monolith).
 *
 * Detection rule: an entity file under `libs/control-plane-db/`
 * belongs to `controlPlane`; everything else belongs to `instance`.
 * This is the only way the two planes meaningfully differ in
 * physical layout today.
 */
type Plane = 'instance' | 'controlPlane';

interface PerPlaneManifest {
  _version?: number;
  $comment?: string;
  instance: { [schema: string]: string[] };
  controlPlane: { [schema: string]: string[] };
}

/**
 * Backward-compatibility shape for the pre-W2-followup-round-3 manifest
 * (flat `schema → tables[]` map). Detected by the absence of a top-
 * level `instance` key. Tooling that reads the manifest directly may
 * key on `_version`; the runtime check below is the same.
 */
type LegacyManifest = { [schema: string]: string[] };

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
 * Detect the plane an entity file belongs to from its filesystem path.
 * The path-based rule covers every entity file the scanner sees today;
 * if a future plane lands (e.g. a separate `libs/edge-db/`), add its
 * fragment here and add a matching manifest section.
 */
function detectPlane(file: string): Plane {
  if (file.includes('libs/control-plane-db') || file.includes('libs\\control-plane-db')) {
    return 'controlPlane';
  }
  return 'instance';
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

/**
 * Load the manifest in either the per-plane (W2 round-3) shape or the
 * legacy flat shape. The legacy fallback exists so external tooling
 * pointed at a pre-round-3 manifest snapshot still loads — but it's
 * treated as instance-only, with controlPlane empty (which preserves
 * the pre-round-3 skip-the-control-plane behavior).
 */
function loadManifest(path: string): PerPlaneManifest {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  if (raw && typeof raw === 'object' && 'instance' in raw) {
    return raw as PerPlaneManifest;
  }
  // Legacy flat-keyed manifest: every key is a schema → tables[]
  // entry under the instance plane. Strip the leading metadata keys
  // (none expected) and pass everything else through.
  const legacy = raw as LegacyManifest;
  return {
    _version: 1,
    instance: legacy,
    controlPlane: {},
  };
}

function buildTableToSchemaIndex(
  manifestSection: { [schema: string]: string[] },
): Map<string, string> {
  const out = new Map<string, string>();
  for (const [schema, tables] of Object.entries(manifestSection)) {
    if (!Array.isArray(tables)) continue;
    for (const t of tables) out.set(t, schema);
  }
  return out;
}

function main() {
  const { root, manifest: manifestPath, ci } = parseArgs(process.argv.slice(2));
  const manifest = loadManifest(manifestPath);
  const instanceIndex = buildTableToSchemaIndex(manifest.instance);
  const controlPlaneIndex = buildTableToSchemaIndex(manifest.controlPlane);

  const files = findEntityFiles(root);
  const violations: { file: string; tableName: string; expected: string; declared: string | undefined; plane: Plane }[] = [];
  for (const file of files) {
    const plane = detectPlane(file);
    const index = plane === 'instance' ? instanceIndex : controlPlaneIndex;
    for (const decl of extractEntities(file)) {
      const expected = index.get(decl.tableName);
      if (!expected) continue;
      if (expected === 'public') {
        if (decl.declaredSchema && decl.declaredSchema !== 'public') {
          violations.push({ file: decl.file, tableName: decl.tableName, expected, declared: decl.declaredSchema, plane });
        }
      } else {
        if (decl.declaredSchema !== expected) {
          violations.push({ file: decl.file, tableName: decl.tableName, expected, declared: decl.declaredSchema, plane });
        }
      }
    }
  }
  if (ci) {
    console.log(JSON.stringify({ violations, total: violations.length }));
  } else if (violations.length > 0) {
    console.log(`\nEntity schema ownership violations (${violations.length}):\n`);
    for (const v of violations) {
      console.log(`  ${v.file}  [${v.plane} plane]`);
      console.log(`    table '${v.tableName}' → expected schema '${v.expected}', declared '${v.declared ?? '(none)'}'`);
    }
  } else {
    console.log('entity-schema-ownership-check: 0 violations');
  }
  process.exit(violations.length > 0 ? 1 : 0);
}

main();
