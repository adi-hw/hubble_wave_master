#!/usr/bin/env tsx
/**
 * no-hs256-signing-check
 *
 * Enforces canon §29.9: HS256 (and every symmetric-key JWT signing path)
 * is forbidden anywhere on the platform. The scanner greps the codebase
 * for the code patterns that introduce symmetric-key signing or
 * verification, and fails the build on any match outside an explicit
 * allowlist.
 *
 * Patterns flagged (code patterns, NOT documentation strings):
 *   1. `from 'jsonwebtoken'` — import of the HS256-capable library.
 *      `jose` is the only allowed JWT library on the platform; it
 *      supports ES256 natively and is the consistent choice across both
 *      planes.
 *   2. `algorithm: 'HS256'` or `algorithms: ['HS256']` — explicit
 *      symmetric-key declaration on a signing or verification path.
 *   3. `JwtModule.register(` / `JwtModule.registerAsync(` — the
 *      `@nestjs/jwt` HS256 module setup. The platform's ES256 path
 *      uses the `KeySigningService` abstraction (canon §29.9) and the
 *      `JwtModule` package is no longer needed.
 *   4. `secretOrKey:` — passport-jwt's symmetric-key verification key.
 *      The ES256 path uses `secretOrKeyProvider` with a per-token
 *      lookup, not a static key.
 *
 * Scope: walks `apps/api/`, `apps/control-plane/`, and `libs/` (per
 * canon §29.9 the rule applies to both planes plus shared libs).
 * Test fixtures and self-test fixtures are exempt only via explicit
 * allowlist entries.
 *
 * Allowlist: `tools/scanners/no-hs256-allowlist.json`. Each entry needs
 * a `target` (file path relative to repo root), `rationale`, `addedBy`,
 * `addedAt`. Per the scanner-conventions README, allowlists shrink over
 * time — new entries require a documented follow-up reference.
 *
 * Exit code:
 *   0  no violations (every match is allowlisted)
 *   1  one or more unallowed matches
 *
 * Usage:
 *   npx tsx tools/scanners/no-hs256-signing-check.ts        (human)
 *   npx tsx tools/scanners/no-hs256-signing-check.ts --ci   (JSON)
 *   npx tsx tools/scanners/no-hs256-signing-check.ts --root=path/to/dir
 */
import { readFileSync, readdirSync, statSync } from 'fs';
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

interface Violation {
  file: string;
  line: number;
  pattern: string;
  match: string;
}

const SCAN_DIRS = ['apps/api', 'apps/control-plane', 'libs'];
const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.claude',
  'tmp',
  '.nx',
]);

interface PatternRule {
  id: string;
  description: string;
  regex: RegExp;
}

const PATTERNS: PatternRule[] = [
  {
    id: 'jsonwebtoken-import',
    description: "import of the HS256-capable `jsonwebtoken` library",
    regex: /\bfrom\s+['"]jsonwebtoken['"]/,
  },
  {
    id: 'require-jsonwebtoken',
    description: "require() of `jsonwebtoken`",
    regex: /\brequire\(\s*['"]jsonwebtoken['"]\s*\)/,
  },
  {
    id: 'algorithm-hs256',
    description: "explicit HS256 declaration in a signing / verification config",
    regex: /\balgorithms?\s*:\s*\[?\s*['"]HS256['"]/,
  },
  {
    id: 'jwt-module-register',
    description: "@nestjs/jwt `JwtModule.register(...)` / `JwtModule.registerAsync(...)`",
    regex: /\bJwtModule\.register(?:Async)?\s*\(/,
  },
  {
    id: 'passport-jwt-secret-or-key',
    description: "passport-jwt `secretOrKey:` (symmetric-key verification)",
    regex: /\bsecretOrKey\s*:\s*[^=]/,
  },
];

function parseArgs(argv: string[]): { root: string; ci: boolean } {
  let root = '.';
  let ci = false;
  for (const arg of argv) {
    if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
    else if (arg === '--ci') ci = true;
  }
  return { root, ci };
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
      } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
        out.push(full);
      }
    }
  }
  for (const dir of SCAN_DIRS) {
    walk(join(root, dir));
  }
  return out;
}

export function scanFile(file: string, src: string): Violation[] {
  const violations: Violation[] = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip whole-line comments — they are documentation, not code.
    const stripped = line.trim();
    if (stripped.startsWith('//') || stripped.startsWith('*')) continue;

    for (const rule of PATTERNS) {
      const m = rule.regex.exec(line);
      if (m) {
        violations.push({
          file,
          line: i + 1,
          pattern: rule.id,
          match: m[0],
        });
      }
    }
  }
  return violations;
}

function toRepoRelative(absPath: string, root: string): string {
  return relative(root, absPath).split('\\').join('/');
}

function main() {
  const { root, ci } = parseArgs(process.argv.slice(2));
  const allowlistPath = join(root, 'tools/scanners/no-hs256-allowlist.json');
  let allowlist: Allowlist = { entries: [] };
  try {
    allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  } catch (err) {
    console.error(`Could not read ${allowlistPath}: ${(err as Error).message}`);
    process.exit(2);
  }
  const allowedFiles = new Set(allowlist.entries.map((e) => e.target));

  const files = findSourceFiles(root);
  const violations: Violation[] = [];
  for (const file of files) {
    let src: string;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const fileViolations = scanFile(file, src);
    if (fileViolations.length === 0) continue;
    const repoRel = toRepoRelative(file, root);
    if (allowedFiles.has(repoRel)) continue;
    for (const v of fileViolations) {
      violations.push({ ...v, file: repoRel });
    }
  }

  if (ci) {
    console.log(JSON.stringify({ violations, total: violations.length }));
  } else if (violations.length > 0) {
    console.log(`\nno-hs256-signing-check: ${violations.length} violation(s)\n`);
    for (const v of violations) {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    pattern: ${v.pattern}`);
      console.log(`    match:   ${v.match}`);
    }
    console.log(
      `\nHS256 / symmetric-key JWT signing is forbidden everywhere on the platform (canon §29.9).`,
    );
    console.log(
      `Either rewrite the call site to the ES256 KeySigningService path, or add an explicit allowlist entry to tools/scanners/no-hs256-allowlist.json with a follow-up reference.`,
    );
  } else {
    console.log('no-hs256-signing-check: ok');
    if (allowlist.entries.length > 0) {
      console.log(`  (${allowlist.entries.length} allowlisted entry/entries tracked)`);
    }
  }

  process.exit(violations.length > 0 ? 1 : 0);
}

const isMain =
  process.argv[1] && process.argv[1].endsWith('no-hs256-signing-check.ts');
if (isMain) {
  main();
}

export { PATTERNS };
