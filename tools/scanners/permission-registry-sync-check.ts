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
 * Modes (W2 Stream 2 PR3 — hard-gate default):
 *   - **Hard gate** (default): exits non-zero on any mismatch in either
 *     direction. Wired as a required CI gate via
 *     `npm run permission-registry:check`.
 *   - **Reporting** (`--reporting`): outputs both lists but exits 0.
 *     Useful when inventorying a backlog of unregistered codes during
 *     a future sweep; not used by CI today. The legacy `--strict`
 *     flag is preserved as a no-op alias.
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
 *   npx tsx tools/scanners/permission-registry-sync-check.ts              (human, hard-gate)
 *   npx tsx tools/scanners/permission-registry-sync-check.ts --ci         (JSON, hard-gate)
 *   npx tsx tools/scanners/permission-registry-sync-check.ts --reporting  (exit 0 regardless)
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

// Matches an entire `@RequirePermission(...)` or
// `@RequireServiceScope(...)` call, including multi-line array
// literals. The body group is non-greedy so nested decorators on the
// next handler do not bleed in. Paired with `QUOTED_TOKEN_RE` below
// to pull every code reference out of the body — covers both the
// single-string and array-literal call shapes:
//
//   @RequirePermission('audit:read')
//   @RequirePermission(['audit:read', 'system:configure'], 'any')
//
// Comments are stripped (preserving offsets) before the regex runs.
const ANY_DECORATOR_RE =
  /@Require(?:Permission|ServiceScope)\(([\s\S]*?)\)/g;

const QUOTED_TOKEN_RE = /['"]([^'"]+)['"]/g;

// `<RequirePermission permission="audit:read" />` style for web clients.
// Tolerates whitespace between the prop name and the value.
const JSX_RE =
  /<RequirePermission\b[^>]*\spermission\s*=\s*['"]([^'"]+)['"]/g;

function parseArgs(argv: string[]): {
  root: string;
  ci: boolean;
  reporting: boolean;
} {
  let root = '.';
  let ci = false;
  let reporting = false;
  for (const arg of argv) {
    if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
    else if (arg === '--ci') ci = true;
    else if (arg === '--reporting') reporting = true;
    // `--strict` is the legacy hard-gate opt-in. Hard-gate is now the
    // default; the flag is preserved as a no-op so existing callers and
    // CI invocations continue to work.
    else if (arg === '--strict') reporting = false;
  }
  return { root, ci, reporting };
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

/**
 * Strip comments (single-line `// ...` and multi-line `/* ... *​/`)
 * from `src` so the decorator regex below cannot capture commented-out
 * code or example lines in JSDoc blocks. Replaces comment characters
 * with spaces (preserving offsets) so the line-number map computed
 * from the input still aligns with regex match positions.
 */
function stripCommentsPreserveOffsets(src: string): string {
  const out = src.split('');
  let i = 0;
  while (i < out.length) {
    const ch = out[i];
    const next = out[i + 1];
    if (ch === '/' && next === '/') {
      // line comment to EOL
      while (i < out.length && out[i] !== '\n') {
        out[i] = out[i] === '\n' ? '\n' : ' ';
        i++;
      }
      continue;
    }
    if (ch === '/' && next === '*') {
      // block comment
      out[i] = ' ';
      out[i + 1] = ' ';
      i += 2;
      while (i < out.length) {
        if (out[i] === '*' && out[i + 1] === '/') {
          out[i] = ' ';
          out[i + 1] = ' ';
          i += 2;
          break;
        }
        if (out[i] !== '\n') out[i] = ' ';
        i++;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      // skip over string literal so a `//` inside a string does not
      // count as a comment start
      const quote = ch;
      i++;
      while (i < out.length && out[i] !== quote) {
        if (out[i] === '\\') i += 2;
        else i++;
      }
      i++;
      continue;
    }
    i++;
  }
  return out.join('');
}

function lineFromOffset(src: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < src.length; i++) {
    if (src[i] === '\n') line++;
  }
  return line;
}

export function scanFile(
  file: string,
  src: string,
): SiteRef[] {
  const refs: SiteRef[] = [];
  const stripped = stripCommentsPreserveOffsets(src);

  // Walk every `@RequirePermission(...)` / `@RequireServiceScope(...)`
  // call. The decorator regex captures the entire body of the call,
  // so the inner `QUOTED_TOKEN_RE` sweep over the body picks up every
  // referenced code regardless of single-string vs array form. The
  // line number is computed from the absolute offset of the quoted
  // token within the stripped source.
  ANY_DECORATOR_RE.lastIndex = 0;
  let dec: RegExpExecArray | null;
  while ((dec = ANY_DECORATOR_RE.exec(stripped)) !== null) {
    // Offset of body capture group `(...)` within `stripped`. The
    // RegExp engine doesn't expose the capture-group start directly,
    // but `dec.index` points at `@`, the prefix `@RequirePermission(`
    // or `@RequireServiceScope(` is the only thing between `@` and the
    // body — find the `(` to anchor.
    const matchText = dec[0];
    const bodyOffsetInMatch = matchText.indexOf('(') + 1;
    const bodyAbsoluteStart = dec.index + bodyOffsetInMatch;
    const body = dec[1];

    // The second positional arg of `@RequirePermission(codes, mode)` is
    // the literal `'any'` or `'all'` mode marker — exclude it so the
    // mode marker is not misread as a permission code. The marker is
    // always positioned after a `]` (array form) or after the comma
    // following the single string. Conservative rule: drop everything
    // after the last `]` in the body for the array form; for the
    // single-string form the body contains no `]`, so trim everything
    // after the first `,` instead (the mode is the only thing past it).
    let codeRegionEnd = body.length;
    const lastBracket = body.lastIndexOf(']');
    if (lastBracket >= 0) {
      codeRegionEnd = lastBracket + 1;
    } else {
      const firstComma = body.indexOf(',');
      if (firstComma >= 0) codeRegionEnd = firstComma;
    }
    const codeRegion = body.slice(0, codeRegionEnd);

    QUOTED_TOKEN_RE.lastIndex = 0;
    let q: RegExpExecArray | null;
    while ((q = QUOTED_TOKEN_RE.exec(codeRegion)) !== null) {
      const absoluteOffset = bodyAbsoluteStart + q.index;
      refs.push({
        code: q[1],
        file,
        line: lineFromOffset(stripped, absoluteOffset),
        source: 'decorator',
      });
    }
  }

  // JSX `<RequirePermission permission="..." />` — line-by-line is fine
  // because JSX props don't span multiple source lines in practice.
  const lines = stripped.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    JSX_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
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
  const { root, ci, reporting } = parseArgs(process.argv.slice(2));

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
    } else if (reporting) {
      console.log(
        `\nMode: --reporting — exiting 0. Drop the flag to enforce as a hard gate.`,
      );
    }
  }

  if (!reporting && total > 0) {
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
