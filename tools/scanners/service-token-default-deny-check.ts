#!/usr/bin/env tsx
/**
 * service-token-default-deny-check
 *
 * Verifies the canon §29.7 contract: every controller handler (or class)
 * that carries `@AllowServiceToken()` MUST also carry a matching
 * `@RequireServiceScope(code)` at the same level. The two decorators
 * together form the platform's service-token authorization contract; an
 * endpoint with `@AllowServiceToken` alone is a programmer error that the
 * JwtAuthGuard surfaces at runtime as 500 — this scanner catches the
 * misconfiguration at PR time so the runtime check never fires in prod.
 *
 * Scope: walks every `*.controller.ts` under `apps/` and `libs/`. Each
 * `@AllowServiceToken()` annotation must be paired with a
 * `@RequireServiceScope(<non-empty literal>)` decorator on the same
 * method OR class. The check is intentionally textual (regex over the
 * source) rather than AST-based — same heuristic posture as the
 * `cross-domain-import-check` scanner (see its docstring for the
 * rationale).
 *
 * Allowlist: this scanner has no allowlist. The contract is binary —
 * either both decorators are present or the endpoint is broken. If a
 * legitimate exception emerges, escalate to a canon §29.7 amendment.
 *
 * Exit code:
 *   0  no violations
 *   1  one or more `@AllowServiceToken()` annotations missing a
 *      matching `@RequireServiceScope(code)`
 *
 * Usage:
 *   npx tsx tools/scanners/service-token-default-deny-check.ts        (human)
 *   npx tsx tools/scanners/service-token-default-deny-check.ts --ci   (JSON)
 *   npx tsx tools/scanners/service-token-default-deny-check.ts --root=path/to/dir
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface Violation {
  file: string;
  line: number;
  reason: string;
}

interface ScanOptions {
  root: string;
}

const SCAN_DIRS = ['apps', 'libs'];
const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.claude',
  'tmp',
  '.nx',
  '__tests__',
]);

function parseArgs(argv: string[]): { root: string; ci: boolean } {
  let root = '.';
  let ci = false;
  for (const arg of argv) {
    if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
    else if (arg === '--ci') ci = true;
  }
  return { root, ci };
}

function findControllerFiles(root: string): string[] {
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
        entry.endsWith('.controller.ts') &&
        !entry.endsWith('.spec.controller.ts') &&
        !entry.endsWith('.controller.spec.ts')
      ) {
        out.push(full);
      }
    }
  }
  for (const dir of SCAN_DIRS) {
    const full = join(root, dir);
    walk(full);
  }
  return out;
}

/**
 * Scan a single controller source for the @AllowServiceToken /
 * @RequireServiceScope pairing.
 *
 * The contract: every `@AllowServiceToken()` decoration must have a
 * `@RequireServiceScope('<non-empty>')` decoration at the SAME scope
 * (same method, or both at class level). Class-level pairs cover any
 * method that doesn't carry a method-level `@RequireServiceScope`.
 *
 * Approach (mirroring cross-domain-import-check's heuristic posture):
 *   1. Find every line that starts with `@AllowServiceToken(` (ignoring
 *      leading whitespace + a possible comment prefix `//`).
 *   2. For each, walk forward in the source to find the next class /
 *      method declaration. The set of decorators between the
 *      `@AllowServiceToken` line and that declaration are the
 *      "decorator block" attached to this target.
 *   3. If the block contains a `@RequireServiceScope(<non-empty literal>)`,
 *      the target is paired — OK.
 *   4. Otherwise check whether a class-level `@RequireServiceScope`
 *      appears earlier in the file (between `@Controller(...)` and
 *      `export class ...`). If yes, the target is covered by the
 *      class-level pair.
 *   5. If neither covers it, record a violation.
 */
export function scanController(file: string, src: string): Violation[] {
  const violations: Violation[] = [];
  const lines = src.split('\n');

  // Locate any class-level @RequireServiceScope (decorator that appears
  // between `@Controller(...)` / decorator block of the class and the
  // `export class` keyword).
  const classLevelScope = findClassLevelRequiredScope(lines);

  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim();
    if (!stripped.startsWith('@AllowServiceToken(')) continue;

    // Walk forward collecting decorator lines until we hit the next
    // declarator (method/function/property/class) or run out.
    const decorators: string[] = [stripped];
    let j = i + 1;
    while (j < lines.length) {
      const t = lines[j].trim();
      if (t === '' || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) {
        j += 1;
        continue;
      }
      if (t.startsWith('@')) {
        decorators.push(t);
        j += 1;
        continue;
      }
      break;
    }

    const hasMethodLevelScope = decorators.some((d) =>
      /^@RequireServiceScope\(\s*['"][^'"]+['"]\s*\)/.test(d),
    );

    if (!hasMethodLevelScope && classLevelScope === null) {
      violations.push({
        file,
        line: i + 1,
        reason:
          '@AllowServiceToken() requires a matching @RequireServiceScope(<code>) at the same handler or at the class (canon §29.7)',
      });
    }
  }

  return violations;
}

function findClassLevelRequiredScope(lines: string[]): number | null {
  // Walk top-down. Track whether we are inside the class decorator
  // block (between the first @Controller-class decorator and the
  // `export class` line). Within that block a @RequireServiceScope
  // counts as class-level.
  let inClassDecoratorBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim();
    if (stripped.startsWith('@Controller(')) {
      inClassDecoratorBlock = true;
      continue;
    }
    if (inClassDecoratorBlock) {
      if (stripped.startsWith('export class ') || stripped.startsWith('class ')) {
        return null;
      }
      if (/^@RequireServiceScope\(\s*['"][^'"]+['"]\s*\)/.test(stripped)) {
        return i + 1;
      }
    }
  }
  return null;
}

function main() {
  const { root, ci } = parseArgs(process.argv.slice(2));
  const files = findControllerFiles(root);

  const violations: Violation[] = [];
  for (const file of files) {
    let src: string;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!src.includes('@AllowServiceToken')) continue;
    violations.push(...scanController(file, src));
  }

  if (ci) {
    console.log(JSON.stringify({ violations, total: violations.length }));
  } else if (violations.length > 0) {
    console.log(
      `\nservice-token-default-deny-check: ${violations.length} violation(s)\n`,
    );
    for (const v of violations) {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.reason}`);
    }
  } else {
    console.log('service-token-default-deny-check: ok');
  }

  process.exit(violations.length > 0 ? 1 : 0);
}

// Skip auto-run when imported by the self-test.
const isMain =
  process.argv[1] && process.argv[1].endsWith('service-token-default-deny-check.ts');
if (isMain) {
  main();
}
