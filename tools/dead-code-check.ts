#!/usr/bin/env ts-node
/**
 * Anti-resurrection scanner (W0 task 10 / Deletion Catalog §D.6).
 *
 * Three independent checks:
 *   1. Trash patterns — files/dirs matching known-dead naming
 *      conventions that have crept back into the source tree
 *      (tmpclaude*, ralph-loop*, .env.backup).
 *   2. Phantom dependencies — package.json `dependencies` /
 *      `devDependencies` entries with zero source imports.
 *   3. Orphan libraries — workspace libraries (libs/<name>/) whose
 *      package alias `@hubblewave/<name>` is not imported anywhere
 *      AND whose source paths are not directly referenced.
 *
 * Out of W0 scope (deferred, documented for future):
 *   - Internal orphan files within a live lib (would require full
 *     ts-morph reachability analysis from "always-live" entry points
 *     like main.ts, app.module.ts, every *.controller.ts).
 *   - Unused exports inside a file (same scope problem).
 *
 * Allowlist at tools/dead-code-allowlist.json is structured:
 *   { type, path, reason, addedBy, addedAt, owedTo }
 * Each pre-existing finding is allowlisted with `owedTo: 'W4'` so
 * Wave 4's deletion pass can clear the allowlist as it goes.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, sep } from 'path';

interface AllowlistEntry {
  type: 'trash-pattern' | 'phantom-dep' | 'orphan-lib';
  path: string;
  reason: string;
  addedBy: string;
  addedAt: string;
  owedTo?: string;
}

interface Finding {
  type: AllowlistEntry['type'];
  path: string;
  detail: string;
}

const ROOT = process.cwd();
const SCAN_ROOTS = ['apps', 'libs', 'tools', 'scripts'];
const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.nx',
  '.git',
  'tmp',
  '.next',
  'out-tsc',
  'playwright-report',
  'test-results',
]);

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const TRASH_PATTERNS: ReadonlyArray<{ regex: RegExp; reason: string }> = [
  { regex: /(?:^|[\\/])tmpclaude[^\\/]*(?:[\\/]|$)/i, reason: 'agent-session trash directory' },
  { regex: /(?:^|[\\/])ralph-loop\.(ps1|md|sh|bat)$/i, reason: 'AI-tooling artifact in source tree' },
  { regex: /(?:^|[\\/])canon-cleanup-ralph-loop\.md$/i, reason: 'AI-tooling artifact (Phase 0–7)' },
  { regex: /(?:^|[\\/])hubblewave-ralph-loop\.md$/i, reason: 'AI-tooling artifact' },
  { regex: /(?:^|[\\/])\.env\.backup$/i, reason: 'historic secret leak (W1 force-rewrites history)' },
];

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

function loadAllowlist(): AllowlistEntry[] {
  const path = join(ROOT, 'tools', 'dead-code-allowlist.json');
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as AllowlistEntry[];
  } catch (e) {
    console.error('Failed to parse tools/dead-code-allowlist.json:', e);
    return [];
  }
}

function isAllowed(allowlist: AllowlistEntry[], type: Finding['type'], path: string): boolean {
  return allowlist.some((e) => {
    if (e.type !== type) return false;
    if (e.path === path) return true;
    if (path.endsWith(e.path)) return true;
    // Directory prefix match: allowlist entry "tools/tmpclaude-x" covers
    // any file under that path (e.g., "tools/tmpclaude-x/foo.ts"). Use
    // POSIX separator since all paths in the scanner are normalized.
    if (path.startsWith(e.path + '/')) return true;
    return false;
  });
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry)) continue;
    const p = join(dir, entry);
    let stat;
    try {
      stat = statSync(p);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walk(p, out);
    } else if (stat.isFile()) {
      out.push(p);
    }
  }
  return out;
}

// ===========================================================================
// Check 1 — Trash patterns
// ===========================================================================

function detectTrashPatterns(allowlist: AllowlistEntry[]): Finding[] {
  const findings: Finding[] = [];
  const allFiles: string[] = [];
  for (const root of SCAN_ROOTS) {
    walk(join(ROOT, root), allFiles);
  }
  // Also scan repo root for stray files like ralph-loop.ps1.
  let rootEntries: string[] = [];
  try {
    rootEntries = readdirSync(ROOT);
  } catch {
    rootEntries = [];
  }
  for (const entry of rootEntries) {
    const p = join(ROOT, entry);
    try {
      if (statSync(p).isFile()) allFiles.push(p);
    } catch {
      continue;
    }
  }

  for (const f of allFiles) {
    const rel = toPosix(relative(ROOT, f));
    for (const t of TRASH_PATTERNS) {
      if (t.regex.test(rel)) {
        if (isAllowed(allowlist, 'trash-pattern', rel)) continue;
        findings.push({ type: 'trash-pattern', path: rel, detail: t.reason });
      }
    }
  }
  return findings;
}

// ===========================================================================
// Check 2 — Phantom dependencies
// ===========================================================================

/**
 * Build the corpus that "uses" of a dependency are searched in. Source
 * is obvious; ALSO scan package.json scripts (a CLI-invoked tool like
 * `nx`, `prettier`, `webpack-cli` is referenced there), AND all root
 * config files (vite.config.*, jest.config.*, eslint.config.*, etc.,
 * which import build plugins like postcss/autoprefixer/vite-plugin-*),
 * AND tsconfig.base.json (which references `tslib` via importHelpers).
 *
 * Without these surfaces, the scanner false-positives every CLI-tool
 * dep — and there are 30+ of those. The heuristic is conservative: a
 * dep is phantom only if NO usage appears in the source OR any config
 * surface OR package.json scripts.
 */
function buildDepUsageCorpus(): string {
  const blobs: string[] = [];

  // Source files.
  for (const root of SCAN_ROOTS) {
    for (const f of walk(join(ROOT, root))) {
      const ext = f.slice(f.lastIndexOf('.')).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(ext)) continue;
      try {
        blobs.push(readFileSync(f, 'utf-8'));
      } catch {
        // tolerated
      }
    }
  }

  // package.json scripts (catches CLI-invoked tools like prettier, nx).
  // Include the entire package.json since dep names also appear in
  // resolutions/overrides blocks.
  try {
    blobs.push(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
  } catch {
    // tolerated
  }

  // Root config files: vite.config.*, jest.config.*, eslint.config.*,
  // webpack.config.*, postcss.config.*, tailwind.config.*, prettier.config.*,
  // babel.config.*, .prettierrc(.*), .eslintrc(.*), tsconfig*.json.
  let rootEntries: string[] = [];
  try {
    rootEntries = readdirSync(ROOT);
  } catch {
    // tolerated
  }
  const CONFIG_PATTERNS = [
    /^vite\.config\./,
    /^jest\.config\./,
    /^jest\.preset\./,
    /^eslint\.config\./,
    /^webpack\.config\./,
    /^postcss\.config\./,
    /^tailwind\.config\./,
    /^prettier\.config\./,
    /^babel\.config\./,
    /^\.prettierrc(?:\.|$)/,
    /^\.eslintrc(?:\.|$)/,
    /^tsconfig.*\.json$/,
    /^nx\.json$/,
    /^\.babelrc(?:\.|$)/,
    /^playwright\.config\./,
  ];
  for (const entry of rootEntries) {
    if (!CONFIG_PATTERNS.some((re) => re.test(entry))) continue;
    try {
      const p = join(ROOT, entry);
      if (statSync(p).isFile()) {
        blobs.push(readFileSync(p, 'utf-8'));
      }
    } catch {
      // tolerated
    }
  }

  // Per-project configs under apps/ and libs/ — vite.config.ts in each
  // already swept by SCAN_ROOTS walker, but project.json (Nx project
  // configs) reference tooling deps too.
  for (const root of ['apps', 'libs']) {
    for (const f of walk(join(ROOT, root))) {
      if (!/(?:project\.json|webpack\.config\.[cm]?[jt]s)$/.test(f)) continue;
      try {
        blobs.push(readFileSync(f, 'utf-8'));
      } catch {
        // tolerated
      }
    }
  }

  return blobs.join('\n');
}

function detectPhantomDeps(allowlist: AllowlistEntry[]): Finding[] {
  const pkgPath = join(ROOT, 'package.json');
  if (!existsSync(pkgPath)) return [];
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const corpus = buildDepUsageCorpus();

  function escape(s: string): string {
    return s.replace(/[.+*?^$()[\]{}|\\]/g, '\\$&');
  }

  const findings: Finding[] = [];
  const allDeps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };
  for (const dep of Object.keys(allDeps)) {
    if (dep.startsWith('@types/')) continue; // type-only deps are runtime-invisible
    if (isAllowed(allowlist, 'phantom-dep', dep)) continue;

    // Two detection patterns, OR'd together:
    //   1. Source-style `from 'dep'`, `require('dep')`, `import('dep')`,
    //      including sub-path imports `from 'dep/sub'`.
    //   2. ANY occurrence as a quoted string in package.json scripts or
    //      config files (e.g., `"format": "prettier --check ."`,
    //      `import postcss from 'postcss'`, or `"vite": "^7"` inside
    //      tsconfig.json `references`). The simpler "dep name as a
    //      whole word in a config-corpus context" check is enough.
    //
    // Loose by design — we'd rather under-report phantoms than ship a
    // scanner that floods the CI run with false positives on every
    // CLI tool. A real removal still requires the engineer to verify
    // (and the dead-code-allowlist serves as the audit trail).
    const escaped = escape(dep);
    const importRe = new RegExp(
      `(?:from|require\\(|import\\()\\s*['"\`]${escaped}(?:[/'"\`]|$)`,
    );
    // For scoped packages (@x/y), avoid greedy boundary by anchoring
    // start with non-word; for unscoped, use full word boundary.
    const wordRe = dep.startsWith('@')
      ? new RegExp(`(?:^|[^A-Za-z0-9_-])${escaped}(?:[^A-Za-z0-9/_-]|$)`)
      : new RegExp(`\\b${escaped}\\b`);

    if (importRe.test(corpus) || wordRe.test(corpus)) {
      continue;
    }

    findings.push({
      type: 'phantom-dep',
      path: dep,
      detail: 'declared in package.json but not referenced in source, scripts, or configs',
    });
  }
  return findings;
}

// ===========================================================================
// Check 3 — Orphan libraries
// ===========================================================================

function detectOrphanLibs(allowlist: AllowlistEntry[]): Finding[] {
  const libsDir = join(ROOT, 'libs');
  if (!existsSync(libsDir)) return [];

  let libNames: string[] = [];
  try {
    libNames = readdirSync(libsDir).filter((n) => {
      try {
        return statSync(join(libsDir, n)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }

  // Read tsconfig.base.json to map alias → primary file.
  const aliasToPath: Record<string, string> = {};
  try {
    const tsc = JSON.parse(readFileSync(join(ROOT, 'tsconfig.base.json'), 'utf-8')) as {
      compilerOptions?: { paths?: Record<string, string[]> };
    };
    const paths = tsc.compilerOptions?.paths ?? {};
    for (const [alias, targets] of Object.entries(paths)) {
      if (targets[0]) aliasToPath[alias] = targets[0];
    }
  } catch {
    // tsconfig parse failure is fatal for this check; bail.
    return [];
  }

  // For each lib, find its primary alias (the one whose target is
  // libs/<name>/src/index.ts). Some libs have no alias declared — skip
  // those (we can't reliably tell if they're dead from outside).
  const libAlias: Record<string, string> = {};
  for (const [alias, target] of Object.entries(aliasToPath)) {
    const m = target.match(/^libs\/([^/]+)\/src\/index\.ts$/);
    if (m) libAlias[m[1]] = alias;
  }

  // Build the source blob the same way phantom-dep does.
  const allSource: string[] = [];
  for (const root of SCAN_ROOTS) {
    for (const f of walk(join(ROOT, root))) {
      const ext = f.slice(f.lastIndexOf('.')).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(ext)) continue;
      try {
        allSource.push(readFileSync(f, 'utf-8'));
      } catch {
        // tolerated
      }
    }
  }
  const sourceBlob = allSource.join('\n');

  function escape(s: string): string {
    return s.replace(/[.+*?^$()[\]{}|\\]/g, '\\$&');
  }

  const findings: Finding[] = [];
  for (const lib of libNames) {
    const alias = libAlias[lib];
    if (!alias) continue; // no alias → cannot reliably assess
    if (isAllowed(allowlist, 'orphan-lib', `libs/${lib}`)) continue;

    // A lib is live if ANY of these match in the source blob:
    //   - `from '@hubblewave/<lib>'` or sub-path
    //   - `require('@hubblewave/<lib>')` or sub-path
    //   - `import('@hubblewave/<lib>')`
    //   - relative imports targeting libs/<lib>/src
    const aliasRe = new RegExp(
      `(?:from|require\\(|import\\()\\s*['"\`]${escape(alias)}(?:[/'"\`]|$)`,
    );
    const subAliasRe = new RegExp(
      `(?:from|require\\(|import\\()\\s*['"\`]${escape(alias)}/`,
    );
    const relRe = new RegExp(`['"\`][./]+libs/${escape(lib)}/`);
    if (aliasRe.test(sourceBlob) || subAliasRe.test(sourceBlob) || relRe.test(sourceBlob)) {
      continue;
    }
    findings.push({
      type: 'orphan-lib',
      path: `libs/${lib}`,
      detail: `no importer of ${alias} or libs/${lib}/* found in source`,
    });
  }
  return findings;
}

// ===========================================================================
// Driver
// ===========================================================================

function main(): void {
  const allowlist = loadAllowlist();
  const findings: Finding[] = [
    ...detectTrashPatterns(allowlist),
    ...detectPhantomDeps(allowlist),
    ...detectOrphanLibs(allowlist),
  ];

  if (findings.length > 0) {
    console.error(`dead-code-check: FAILED (${findings.length} finding(s))`);
    for (const f of findings) {
      console.error(`  [${f.type}] ${f.path}: ${f.detail}`);
    }
    console.error('');
    console.error(
      'Resolution: delete the dead code, OR add an entry to ' +
        'tools/dead-code-allowlist.json with structured reason+addedBy+' +
        'addedAt (and owedTo for items being cleaned by a later wave).',
    );
    process.exit(1);
  }

  console.log('dead-code-check: ok');
  if (allowlist.length > 0) {
    console.log(`  (${allowlist.length} allowlisted entry/entries tracked):`);
    for (const e of allowlist) {
      const owed = e.owedTo ? ` [owed to ${e.owedTo}]` : '';
      console.log(`    - [${e.type}] ${e.path}${owed}`);
    }
  }
}

main();
