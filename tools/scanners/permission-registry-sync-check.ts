#!/usr/bin/env tsx
/**
 * permission-registry-sync-check
 *
 * Verifies that the `PERMISSION_REGISTRY` constant in
 * `libs/permission-registry/src/lib/registry.ts` is in sync with every
 * `@RequirePermission(...)` / `@RequireServiceScope(...)` /
 * `<RequirePermission permission="..." />` call site in the codebase.
 *
 * Two failure modes (collected together — the scanner reports both
 * directions per run):
 *
 *   1. **Unregistered call site** — a `@RequirePermission('foo')` or
 *      `@RequireServiceScope('foo')` references a code that is NOT in
 *      `PERMISSION_REGISTRY`. This is the more dangerous case; the
 *      runtime guard cannot resolve the code and the endpoint fails
 *      open or fails closed depending on the guard's defaults.
 *
 *   2. **Orphan registry entry** — a `PERMISSION_REGISTRY` entry has
 *      zero `@RequirePermission` / `@RequireServiceScope` references
 *      anywhere in `apps/api/`, `apps/control-plane/`,
 *      `apps/web-client/`, or `apps/web-control-plane/`. The entry is
 *      dead weight and either needs to be wired or deleted.
 *
 * Modes:
 *   - **Reporting-only** (default, Stream 2 PR1): outputs both lists
 *     but exits 0. The CI job is non-blocking; the data informs the
 *     Stream 3 sweep + Stream 2 PR3 registry expansion.
 *   - **Hard gate** (--strict, Stream 2 PR3): exits non-zero on any
 *     mismatch in either direction. Wired as a required CI gate then.
 *
 * Scope: walks `apps/api/**`, `apps/control-plane/**`,
 * `apps/web-client/**`, `apps/web-control-plane/**`. Skips
 * `node_modules`, `dist`, `tmp`, `.nx`, `.claude`, `.git`.
 *
 * Allowlist: `tools/scanners/permission-registry-sync-allowlist.json`
 * — entries `{ target, rationale, addedBy, addedAt, followUp? }` per
 * the standard schema. `target` is a permission code. Allowlisted
 * codes are exempt from BOTH directions (e.g. a code that's planned
 * for an in-flight PR but not yet referenced).
 *
 * Usage:
 *   npx tsx tools/scanners/permission-registry-sync-check.ts           (human, reporting)
 *   npx tsx tools/scanners/permission-registry-sync-check.ts --ci      (JSON, reporting)
 *   npx tsx tools/scanners/permission-registry-sync-check.ts --strict  (hard gate)
 *   npx tsx tools/scanners/permission-registry-sync-check.ts --root=path
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

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

interface RegistryEntry {
  code: string;
}

interface SiteRef {
  code: string;
  file: string;
  line: number;
  source: 'decorator' | 'jsx';
}

const SCAN_DIRS = [
  'apps/api',
  'apps/control-plane',
  'apps/web-client',
  'apps/web-control-plane',
];
const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.claude',
  'tmp',
  '.nx',
]);

// `@RequirePermission('audit:read')` / `@RequireServiceScope('audit:read')`
// Both single- and double-quoted. Comments are skipped at the line level
// before the regex runs.
const DECORATOR_RE =
  /@Require(?:Permission|ServiceScope)\(\s*['"]([^'"]+)['"]/g;

// `<RequirePermission permission="audit:read" />` style for web clients.
// Tolerates whitespace between the prop name and the value.
const JSX_RE =
  /<RequirePermission\b[^>]*\spermission\s*=\s*['"]([^'"]+)['"]/g;

function parseArgs(argv: string[]): {
  root: string;
  ci: boolean;
  strict: boolean;
} {
  let root = '.';
  let ci = false;
  let strict = false;
  for (const arg of argv) {
    if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
    else if (arg === '--ci') ci = true;
    else if (arg === '--strict') strict = true;
  }
  return { root, ci, strict };
}

function findSourceFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (IGNORE_DIRS.has(entry)) continue;
        walk(full);
      } else if (
        (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
        !entry.endsWith('.d.ts')
      ) {
        out.push(full);
      }
    }
  }
  for (const dir of SCAN_DIRS) {
    walk(join(root, dir));
  }
  return out;
}

function loadRegistry(root: string): RegistryEntry[] {
  const registryPath = join(
    root,
    'libs/permission-registry/src/lib/registry.ts',
  );
  if (!existsSync(registryPath)) {
    throw new Error(`Registry source not found at ${registryPath}`);
  }
  const src = readFileSync(registryPath, 'utf8');
  // Extract every `code: 'xxx'` line. Strict enough to skip stray
  // matches in comments because comments are filtered at line level.
  const entries: RegistryEntry[] = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.trim();
    if (stripped.startsWith('//') || stripped.startsWith('*')) continue;
    const m = /\bcode\s*:\s*['"]([^'"]+)['"]/.exec(line);
    if (m) entries.push({ code: m[1] });
  }
  return entries;
}

export function scanFile(
  file: string,
  src: string,
): SiteRef[] {
  const refs: SiteRef[] = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.trim();
    if (stripped.startsWith('//') || stripped.startsWith('*')) continue;
    let m: RegExpExecArray | null;
    DECORATOR_RE.lastIndex = 0;
    while ((m = DECORATOR_RE.exec(line)) !== null) {
      refs.push({ code: m[1], file, line: i + 1, source: 'decorator' });
    }
    JSX_RE.lastIndex = 0;
    while ((m = JSX_RE.exec(line)) !== null) {
      refs.push({ code: m[1], file, line: i + 1, source: 'jsx' });
    }
  }
  return refs;
}

function toRepoRelative(absPath: string, root: string): string {
  return relative(root, absPath).split('\\').join('/');
}

function main() {
  const { root, ci, strict } = parseArgs(process.argv.slice(2));

  const allowlistPath = join(
    root,
    'tools/scanners/permission-registry-sync-allowlist.json',
  );
  let allowlist: Allowlist = { entries: [] };
  try {
    allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  } catch (err) {
    console.error(
      `Could not read ${allowlistPath}: ${(err as Error).message}`,
    );
    process.exit(2);
  }
  const allowedCodes = new Set(allowlist.entries.map((e) => e.target));

  const registry = loadRegistry(root);
  const registeredCodes = new Set(registry.map((e) => e.code));

  const files = findSourceFiles(root);
  const allRefs: SiteRef[] = [];
  for (const file of files) {
    let src: string;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const refs = scanFile(file, src);
    if (refs.length === 0) continue;
    for (const ref of refs) {
      allRefs.push({ ...ref, file: toRepoRelative(file, root) });
    }
  }

  const referencedCodes = new Set(allRefs.map((r) => r.code));

  // Direction 1: call site references a code NOT in the registry.
  const unregistered: SiteRef[] = [];
  for (const ref of allRefs) {
    if (allowedCodes.has(ref.code)) continue;
    if (!registeredCodes.has(ref.code)) unregistered.push(ref);
  }

  // Direction 2: registry entry has zero call-site references.
  const orphans: string[] = [];
  for (const entry of registry) {
    if (allowedCodes.has(entry.code)) continue;
    if (!referencedCodes.has(entry.code)) orphans.push(entry.code);
  }

  const total = unregistered.length + orphans.length;

  if (ci) {
    console.log(
      JSON.stringify({
        unregistered,
        orphans,
        total,
        registeredCount: registry.length,
        callSiteCount: allRefs.length,
      }),
    );
  } else {
    console.log(
      `permission-registry-sync-check: registry has ${registry.length} entry/entries; call sites: ${allRefs.length} reference(s)`,
    );
    if (unregistered.length > 0) {
      console.log(`\nUnregistered call sites (${unregistered.length}):`);
      const byCode = new Map<string, SiteRef[]>();
      for (const ref of unregistered) {
        const bucket = byCode.get(ref.code) ?? [];
        bucket.push(ref);
        byCode.set(ref.code, bucket);
      }
      for (const [code, refs] of byCode.entries()) {
        console.log(`  ${code}  (${refs.length} site${refs.length === 1 ? '' : 's'})`);
        for (const ref of refs.slice(0, 3)) {
          console.log(`    ${ref.file}:${ref.line}  [${ref.source}]`);
        }
        if (refs.length > 3) {
          console.log(`    ... and ${refs.length - 3} more`);
        }
      }
    }
    if (orphans.length > 0) {
      console.log(`\nOrphan registry entries (${orphans.length}) — no call site:`);
      for (const code of orphans) {
        console.log(`  ${code}`);
      }
    }
    if (total === 0) {
      console.log('  in sync');
    } else if (!strict) {
      console.log(
        `\nMode: reporting-only — exiting 0. Stream 2 PR3 flips to --strict.`,
      );
    }
  }

  if (strict && total > 0) {
    process.exit(1);
  }
  process.exit(0);
}

const isMain =
  process.argv[1] &&
  process.argv[1].endsWith('permission-registry-sync-check.ts');
if (isMain) {
  main();
}
