import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve, dirname, sep } from 'path';

/**
 * Static-analysis check for canon §3 (Platform, not application) and the
 * service-responsibility map in PART 2 §C of the architectural plan.
 *
 * Scans every TypeScript source file under apps/svc-XYZ/src/ and rejects any
 * import that crosses a service boundary directly. Cross-service collaboration
 * must go through libs/ (the shared surface). Same-service imports,
 * libs/ imports, and third-party packages are always allowed.
 *
 * This enforces Fix 12 of the remediation plan: a service importing from
 * another service's source today silently passes every other gate, because no
 * authz/audit/security check inspects import topology.
 */

type Violation = {
  file: string;
  line: number;
  importPath: string;
  fromService: string;
  toService: string;
};

const ROOT = process.cwd();
const APPS_DIR = join(ROOT, 'apps');
const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  'tmp',
  '.nx',
  '.git',
  '__tests__',
]);

/**
 * Cross-service imports that have been accepted as deferred work pending a
 * structural refactor (Plan Fix 24 — earn the service boundaries). Each entry
 * lists the importing file, the import path that crosses a boundary, and the
 * follow-up wave. New entries require explicit founder/architect approval.
 */
const KNOWN_VIOLATIONS: Array<{
  file: string;
  importPath: string;
  rationale: string;
  followUp: string;
}> = [];

const SERVICE_DIR_RE = /^svc-[a-z0-9-]+$/;

function isServiceDir(name: string): boolean {
  return SERVICE_DIR_RE.test(name);
}

function walk(dir: string, files: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry)) {
      continue;
    }
    const fullPath = join(dir, entry);
    let stats;
    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (
      (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) &&
      !fullPath.endsWith('.d.ts')
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

/**
 * Returns the service name (e.g. "svc-data") that owns this absolute file
 * path, or null if the file is not under an apps/svc-XYZ root.
 */
function serviceOf(absolutePath: string): string | null {
  const rel = toPosix(relative(APPS_DIR, absolutePath));
  if (rel.startsWith('..')) return null;
  const first = rel.split('/')[0];
  return isServiceDir(first) ? first : null;
}

/**
 * Extract every module specifier referenced from a TS source file along with
 * its line number. Covers static imports, dynamic re-exports, `import type`,
 * `import(...)` expressions, and `require(...)`.
 */
function extractImports(content: string): Array<{ spec: string; line: number }> {
  const results: Array<{ spec: string; line: number }> = [];
  const lines = content.split(/\r?\n/);
  // Patterns deliberately permissive — false positives are downgraded to
  // "unknown specifier" in classify(), not raised as violations.
  const patterns: RegExp[] = [
    /\bimport\s+(?:type\s+)?[^'"`;]*?\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?[^'"`;]*?\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const offset = match.index;
      // Compute 1-based line number from offset.
      let line = 1;
      let count = 0;
      for (const l of lines) {
        if (count + l.length + 1 > offset) break;
        count += l.length + 1;
        line++;
      }
      results.push({ spec: match[1], line });
    }
  }
  return results;
}

/**
 * Resolves an import specifier to a destination service if (and only if) it
 * lands inside another apps/svc-XYZ source tree. Returns null when the import
 * is allowed (libs, third-party, same service, untracked).
 */
function resolveCrossServiceTarget(
  importerFile: string,
  spec: string,
  fromService: string,
): string | null {
  // Third-party (bare specifier without a leading "." or "/") is always allowed
  // unless it explicitly addresses an apps path through a workspace alias.
  // None of the configured tsconfig.base.json paths point at apps/, but defend
  // against future aliases that might.
  if (
    !spec.startsWith('.') &&
    !spec.startsWith('/') &&
    !spec.startsWith('apps/') &&
    !spec.startsWith('@hubblewave/svc-')
  ) {
    return null;
  }

  // Workspace-relative absolute (e.g. "apps/svc-other/src/...").
  if (spec.startsWith('apps/')) {
    const segments = spec.split('/');
    if (segments.length >= 2 && isServiceDir(segments[1])) {
      const target = segments[1];
      return target === fromService ? null : target;
    }
    return null;
  }

  // Hypothetical cross-service alias.
  if (spec.startsWith('@hubblewave/svc-')) {
    const target = spec.replace('@hubblewave/', '').split('/')[0];
    if (isServiceDir(target)) {
      return target === fromService ? null : target;
    }
    return null;
  }

  // Relative path: resolve against the importing file's directory and check
  // whether the absolute target lives under a different apps/svc-* root.
  if (spec.startsWith('.') || spec.startsWith('/')) {
    const resolved = resolve(dirname(importerFile), spec);
    const targetService = serviceOf(resolved);
    if (targetService && targetService !== fromService) {
      return targetService;
    }
    return null;
  }

  return null;
}

function isKnownViolation(file: string, importPath: string): boolean {
  const rel = toPosix(relative(ROOT, file));
  return KNOWN_VIOLATIONS.some(
    (entry) => rel.endsWith(entry.file) && entry.importPath === importPath,
  );
}

function detectViolations(): Violation[] {
  const violations: Violation[] = [];
  const serviceDirs = (() => {
    try {
      return readdirSync(APPS_DIR).filter((name) => {
        if (!isServiceDir(name)) return false;
        const srcDir = join(APPS_DIR, name, 'src');
        try {
          return statSync(srcDir).isDirectory();
        } catch {
          return false;
        }
      });
    } catch {
      return [];
    }
  })();

  for (const service of serviceDirs) {
    const srcDir = join(APPS_DIR, service, 'src');
    const files = walk(srcDir);
    for (const file of files) {
      const fromService = serviceOf(file);
      if (!fromService) continue;
      let content: string;
      try {
        content = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const imports = extractImports(content);
      for (const { spec, line } of imports) {
        const toService = resolveCrossServiceTarget(file, spec, fromService);
        if (!toService) continue;
        if (isKnownViolation(file, spec)) continue;
        violations.push({
          file: toPosix(relative(ROOT, file)),
          line,
          importPath: spec,
          fromService,
          toService,
        });
      }
    }
  }
  return violations;
}

function main() {
  const violations = detectViolations();
  if (violations.length === 0) {
    console.log('service boundary check: ok');
    if (KNOWN_VIOLATIONS.length > 0) {
      console.log(`  (${KNOWN_VIOLATIONS.length} allowlisted cross-service import(s) tracked):`);
      for (const entry of KNOWN_VIOLATIONS) {
        console.log(`    - ${entry.file} -> ${entry.importPath}  [${entry.followUp}]`);
      }
    }
    return;
  }

  console.error(`service boundary check: FAILED (${violations.length} violation(s))`);
  console.error('Cross-service source imports are forbidden. Services must');
  console.error('collaborate through libs/* (the shared surface), HTTP RPC,');
  console.error('or the outbox event bus — not by reaching into another');
  console.error("service's source tree directly. (Plan Fix 12 / canon §3.)");
  console.error('');
  for (const v of violations) {
    console.error(
      `  ${v.file}:${v.line} - ${v.fromService} imports from ${v.toService}: ${v.importPath}`,
    );
  }
  process.exit(1);
}

main();
