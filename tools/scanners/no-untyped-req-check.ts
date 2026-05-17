#!/usr/bin/env tsx
/**
 * no-untyped-req-check
 *
 * Enforces a typed shape on every `@Req()` / `@Request()` parameter in
 * every controller handler. The canon §29 contract is that the request
 * carries a discriminated-union `RequestContext` (`{ kind: 'user', ... } |
 * { kind: 'service', ... }`) — accessing `req.user.something` against the
 * raw Express `Request` type bypasses the narrowing the JwtAuthGuard
 * sets up and silently drops type safety on the security-critical
 * caller-identity path.
 *
 * Two types fail the scanner:
 *   1. `@Req() req: any` — any-typed parameter, dodges all narrowing.
 *   2. `@Req() req: Request` — raw Express Request, missing the
 *      `request.context` / `request.user` augmentation.
 *
 * Accepted shapes (any other type name passes):
 *   - `InstanceRequest`, `AuthenticatedRequest`, `TypedRequest`, etc.
 *   - Inline object types: `{ user?: ..., context?: ... }`.
 *
 * The scanner is intentionally text-heuristic (matches the shape used
 * by `cross-domain-import-check` and `service-token-default-deny-check`).
 * AST-based parsing via ts-morph is a future option if false positives
 * or negatives emerge.
 *
 * Allowlist: `tools/scanners/no-untyped-req-allowlist.json` — each entry
 * `{ target, rationale, addedBy, addedAt, followUp? }` per the standard
 * allowlist schema. Allowlists shrink over time.
 *
 * Exit code:
 *   0  no unallowed violations
 *   1  one or more unallowed `@Req() : any` or `@Req() : Request`
 *
 * Usage:
 *   npx tsx tools/scanners/no-untyped-req-check.ts        (human)
 *   npx tsx tools/scanners/no-untyped-req-check.ts --ci   (JSON)
 *   npx tsx tools/scanners/no-untyped-req-check.ts --root=path/to/dir
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
  type: 'any' | 'request';
  match: string;
}

const SCAN_DIRS = ['apps', 'libs'];
const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.claude',
  'tmp',
  '.nx',
]);

// Captures: `@Req()` or `@Request()` (optional whitespace), parameter
// name, then `:` and one of the forbidden type names. Optional `?` for
// optional parameters and trailing `,`/`)` are tolerated.
//
// `Request` matches bare. We intentionally tolerate `: Request<...>` —
// some Express type augmentations make a parameterized Request OK.
const FORBIDDEN_RE =
  /@Req(?:uest)?\(\)\s+(\w+)\s*\??\s*:\s*(any|Request)(?=\s*[,)])/;

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
        !entry.endsWith('.controller.spec.ts')
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

export function scanController(file: string, src: string): Violation[] {
  const violations: Violation[] = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.trim();
    // Skip whole-line comments — documentation about @Req patterns is fine.
    if (stripped.startsWith('//') || stripped.startsWith('*')) continue;
    const m = FORBIDDEN_RE.exec(line);
    if (m) {
      violations.push({
        file,
        line: i + 1,
        type: m[2] === 'any' ? 'any' : 'request',
        match: m[0],
      });
    }
  }
  return violations;
}

function toRepoRelative(absPath: string, root: string): string {
  return relative(root, absPath).split('\\').join('/');
}

function main() {
  const { root, ci } = parseArgs(process.argv.slice(2));
  const allowlistPath = join(root, 'tools/scanners/no-untyped-req-allowlist.json');
  let allowlist: Allowlist = { entries: [] };
  try {
    allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  } catch (err) {
    console.error(`Could not read ${allowlistPath}: ${(err as Error).message}`);
    process.exit(2);
  }
  const allowedFiles = new Set(allowlist.entries.map((e) => e.target));

  const files = findControllerFiles(root);
  const violations: Violation[] = [];
  for (const file of files) {
    let src: string;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const fileViolations = scanController(file, src);
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
    console.log(`\nno-untyped-req-check: ${violations.length} violation(s)\n`);
    for (const v of violations) {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    type:  ${v.type}`);
      console.log(`    match: ${v.match}`);
    }
    console.log(
      `\nUse a typed request shape (InstanceRequest, AuthenticatedRequest, or an inline { user?, context? } type) instead of \`any\` / raw \`Request\` (canon §29.3 + §29.6).`,
    );
    console.log(
      `Either rewrite the parameter type or add an explicit allowlist entry to tools/scanners/no-untyped-req-allowlist.json with a follow-up reference.`,
    );
  } else {
    console.log('no-untyped-req-check: ok');
    if (allowlist.entries.length > 0) {
      console.log(`  (${allowlist.entries.length} allowlisted entry/entries tracked)`);
    }
  }

  process.exit(violations.length > 0 ? 1 : 0);
}

const isMain =
  process.argv[1] && process.argv[1].endsWith('no-untyped-req-check.ts');
if (isMain) {
  main();
}
