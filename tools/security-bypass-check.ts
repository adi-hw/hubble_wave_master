import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

type Violation = {
  file: string;
  reason: string;
};

const ROOT = process.cwd();
const APP_ROOT = join(ROOT, 'apps');
const LIB_ROOT = join(ROOT, 'libs');
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'tmp', '.nx', '.git']);

/**
 * Allowlist of source paths that legitimately use @Public() to opt out
 * of the global JwtAuthGuard chain.
 *
 * Each entry MUST fall into one of these categories:
 *   1. Health endpoints (k8s liveness/readiness; no caller identity).
 *   2. Authentication entry points (login, refresh, register, MFA enroll,
 *      magic-link, password-reset, email-verification, SSO callbacks).
 *   3. Public catalogs intentionally readable without auth (theme reads
 *      that render on the login page; pack catalog browse).
 *   4. OAuth / OIDC integration callbacks (the IdP, not a HW user, calls).
 *   5. Pack install endpoints whose authorization is enforced by a
 *      dedicated guard (PackInstallGuard) that supports BOTH
 *      control-plane install tokens and user JWTs — @Public() opts out
 *      of the global chain so the dedicated guard can be authoritative.
 *
 * Drift detection (W0 task 3): every @Public() site under apps/<svc>/src/
 * MUST be in this allowlist. The scanner self-test asserts both that
 * the allowlist matches reality AND that a planted unallowlisted
 * @Public() fails the scanner.
 *
 * Reconciled with reality on 2026-05-09 (W0 task 3 / F105) — was 11
 * entries, now 27, every entry in a category. Cross-platform path
 * normalization fixed the same commit (Windows local previously hid
 * the drift because the filter used forward-slash on backslash paths).
 */
const PUBLIC_ALLOWLIST = new Set([
  // -------------------------------------------------------------------
  // Category 1: Health endpoints (k8s probes).
  // -------------------------------------------------------------------
  'apps/svc-automation/src/app/health.controller.ts',
  'apps/svc-ava/src/app/health.controller.ts',
  'apps/svc-control-plane/src/app/health-aggregator/health-aggregator.controller.ts',
  // ARC-W1 post-migration path (apps/control-plane home — separate Nest app per spec §2).
  'apps/control-plane/src/app/health-aggregator/health-aggregator.controller.ts',
  'apps/svc-data/src/app/health.controller.ts',
  'apps/svc-identity/src/app/health.controller.ts',
  'apps/svc-insights/src/app/health.controller.ts',
  'apps/svc-instance-api/src/app/health.controller.ts',
  'apps/svc-metadata/src/app/health.controller.ts',
  'apps/svc-notify/src/app/health.controller.ts',
  'apps/svc-view-engine/src/app/health.controller.ts',
  'apps/svc-workflow/src/app/health.controller.ts',
  // ARC-W1 post-migration paths (apps/api). svc-data, svc-identity,
  // svc-metadata, svc-automation, and svc-ava services are now thin adapters;
  // their controller files live at the apps/api locations below. Health
  // controllers in data, metadata, automation, and ava were renamed to
  // disambiguate route prefixes:
  //   data:       /data/health       (DataHealthController)
  //   metadata:   /metadata/health   (MetadataHealthController)
  //   identity:   /health            (HealthController, unchanged)
  //   automation: /automation/health (AutomationHealthController)
  //   ava:        /ava/health        (AvaHealthController)
  'apps/api/src/app/data/data-health.controller.ts',
  'apps/api/src/app/identity/health.controller.ts',
  'apps/api/src/app/metadata/metadata-health.controller.ts',
  'apps/api/src/app/automation/automation-health.controller.ts',
  'apps/api/src/app/ava/ava-health.controller.ts',
  // -------------------------------------------------------------------
  // Category 2: Authentication entry points.
  // -------------------------------------------------------------------
  'apps/svc-control-plane/src/app/auth/auth.controller.ts',
  'apps/control-plane/src/app/auth/auth.controller.ts',
  'apps/svc-identity/src/app/auth/auth.controller.ts',
  'apps/svc-identity/src/app/auth/email-verification.controller.ts',
  'apps/svc-identity/src/app/auth/magic-link.controller.ts',
  'apps/svc-identity/src/app/auth/password-reset.controller.ts',
  'apps/svc-identity/src/app/auth/sso/sso-config.controller.ts',
  'apps/svc-identity/src/app/auth/sso/sso.controller.ts',
  'apps/svc-identity/src/app/oidc/oidc.controller.ts',
  'apps/svc-instance-api/src/app/identity/auth/auth.controller.ts',
  'apps/svc-instance-api/src/app/identity/auth/sso-config.controller.ts',
  // ARC-W1 post-migration paths (apps/api/identity).
  'apps/api/src/app/identity/auth/auth.controller.ts',
  'apps/api/src/app/identity/auth/email-verification.controller.ts',
  'apps/api/src/app/identity/auth/magic-link.controller.ts',
  'apps/api/src/app/identity/auth/password-reset.controller.ts',
  'apps/api/src/app/identity/auth/sso/sso-config.controller.ts',
  'apps/api/src/app/identity/auth/sso/sso.controller.ts',
  'apps/api/src/app/identity/oidc/oidc.controller.ts',
  // -------------------------------------------------------------------
  // Category 3: Public catalogs / unauthenticated render surfaces.
  // -------------------------------------------------------------------
  'apps/svc-control-plane/src/app/packs/packs.catalog.controller.ts',
  'apps/control-plane/src/app/packs/packs.catalog.controller.ts',
  // theme read endpoints render on the unauthenticated login page; the
  // controller has @Public on individual GET routes only — POST/PUT/
  // DELETE remain auth-required (verified at theme.controller.ts).
  'apps/svc-metadata/src/app/theme/theme.controller.ts',
  'apps/api/src/app/metadata/theme/theme.controller.ts',
  // -------------------------------------------------------------------
  // Category 4: OAuth / OIDC integration callbacks (IdP-initiated).
  // -------------------------------------------------------------------
  'apps/svc-data/src/app/integration/oauth2.controller.ts',
  'apps/api/src/app/data/integration/oauth2.controller.ts',
  // -------------------------------------------------------------------
  // Category 5: Auth handled by a dedicated guard (PackInstallGuard).
  // -------------------------------------------------------------------
  'apps/svc-metadata/src/app/packs/packs.controller.ts',
  'apps/api/src/app/metadata/packs/packs.controller.ts',
]);

export { PUBLIC_ALLOWLIST };

const BANNED_PATTERNS: Array<{
  pattern: RegExp;
  description: string;
  allowlist?: Set<string>;
}> = [
  {
    pattern: /\beval\s*\(/,
    description: 'eval() is not allowed',
    allowlist: new Set([
      // Sandbox bypass tests — eval is the test subject. The script-sandbox
      // service rejects eval inside user-supplied scripts; the spec exercises
      // that rejection path with literal eval() snippets passed AS DATA into
      // evaluateCondition / execute. JavaScript eval is never invoked by the
      // spec; the strings are parsed by expr-eval and rejected by the
      // deny-list. Refs Plan §S5 W1.9 / Fix 6.
      'apps/svc-automation/src/app/runtime/script-sandbox.service.spec.ts',
      // ARC-W1 post-migration path (apps/api/automation home). svc-automation
      // is now a thin adapter; the spec lives at the apps/api location.
      'apps/api/src/app/automation/runtime/script-sandbox.service.spec.ts',
      // Safe-expression-evaluator RCE corpus (W1 task 8 / F027). Same
      // rationale as script-sandbox: `eval(` and other RCE patterns
      // appear AS STRING DATA in the corpus that the evaluator must
      // reject. The spec asserts each string is rejected by the
      // SafeExpressionEvaluator; JavaScript eval is never invoked.
      'libs/automation/src/lib/safe-expression-evaluator.spec.ts',
      // Redis client EVAL command for atomic Lua scripts. The Lua source is a
      // hardcoded constant (release-the-lock-if-we-still-own-it pattern). No
      // user input flows into the script and Redis Lua is server-side
      // sandboxed. This is `client.eval(lua, ...)`, NOT JavaScript eval.
      'apps/svc-ava/src/app/embedding.controller.ts',
      // ARC-W1 post-migration path (apps/api/ava home).
      'apps/api/src/app/ava/embedding.controller.ts',
      'apps/svc-insights/src/app/backup/backup.service.ts',
    ]),
  },
  {
    pattern: /\bnew\s+Function\s*\(/,
    description: 'new Function() is not allowed',
  },
  {
    pattern: /\bspawn\s*\(/,
    description: 'spawn() is restricted to approved runtime utilities',
    allowlist: new Set([
      'apps/svc-insights/src/app/backup/backup.service.ts',
      'apps/svc-control-plane/src/app/terraform/terraform.executor.ts',
      // ARC-W1 post-migration path (apps/control-plane home).
      'apps/control-plane/src/app/terraform/terraform.executor.ts',
    ]),
  },
];

const AVA_URL_ALLOWLIST = new Set([
  'apps/svc-ava/src/main.ts',
]);

function walk(dir: string, files: string[] = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) {
      continue;
    }
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (fullPath.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function toRelative(filePath: string): string {
  return relative(ROOT, filePath).replace(/\\/g, '/');
}

/**
 * Detects whether a file actually uses `@Public()` as a decorator,
 * vs. referencing the symbol in comments / metadata reads.
 *
 * Files like `apps/svc-identity/src/app/abac/abac.guard.ts` reference
 * `@Public()` in JSDoc/explanatory comments without applying the
 * decorator. The naive `content.includes('@Public()')` check
 * false-positives those files.
 *
 * Strategy:
 *   - Strip block comments first.
 *   - Walk each line; trim line comments off the end.
 *   - Match `@Public()` only when it is the first non-whitespace
 *     token on the line (decorator-on-its-own-line) OR when it is
 *     immediately followed by another `@` (decorator chain like
 *     `@Public() @Get()`).
 */
function fileUsesPublicDecorator(content: string): boolean {
  const noBlockComments = content.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const rawLine of noBlockComments.split('\n')) {
    const beforeComment = rawLine.replace(/\/\/.*$/, '');
    const trimmed = beforeComment.trim();
    if (/^@Public\(\)\s*(?:@|$)/.test(trimmed)) {
      return true;
    }
  }
  return false;
}

function checkPublicEndpoints(violations: Violation[]) {
  // Use the normalized relative path for the path-substring filter; the
  // raw `file` is OS-native (backslashes on Windows, forward slashes on
  // Linux). Without normalization, Windows local runs would silently
  // pass with zero matches while CI on Linux would catch real drift —
  // this was the F105 backstop bug surfaced during W0 task 3.
  const files = walk(APP_ROOT).filter((file) =>
    toRelative(file).includes('/src/app/'),
  );
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (!fileUsesPublicDecorator(content)) {
      continue;
    }
    const rel = toRelative(file);
    if (!PUBLIC_ALLOWLIST.has(rel)) {
      violations.push({
        file: rel,
        reason: 'Public endpoint requires allowlist approval',
      });
    }
  }
}

function checkBannedPatterns(violations: Violation[]) {
  const files = [...walk(APP_ROOT), ...walk(LIB_ROOT)];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const rel = toRelative(file);
    for (const rule of BANNED_PATTERNS) {
      if (!rule.pattern.test(content)) {
        continue;
      }
      if (rule.allowlist && rule.allowlist.has(rel)) {
        continue;
      }
      violations.push({
        file: rel,
        reason: rule.description,
      });
    }

    if (
      /from ['"]child_process['"]/.test(content) ||
      /require\(['"]child_process['"]\)/.test(content)
    ) {
      if (/\bexecSync\s*\(/.test(content)) {
        violations.push({
          file: rel,
          reason: 'execSync() from child_process is not allowed',
        });
      }
      if (/\bexec\s*\(/.test(content)) {
        violations.push({
          file: rel,
          reason: 'exec() from child_process is not allowed',
        });
      }
    }
  }
}

// Match a literal string containing an http(s):// URL when used in code
// (assignments, fetch calls, axios.get, new URL, etc). Excludes URLs that
// appear only inside line/block comments or docstrings.
const HARDCODED_URL_PATTERN = /(?:^|[^/*])(?:['"`])https?:\/\/[^\s'"`]+['"`]/m;

function stripCommentsAndStrings(source: string): string {
  // Remove block comments
  let out = source.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove single-line comments
  out = out.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  return out;
}

function checkAvaExternalUrls(violations: Violation[]) {
  const avaRoot = join(APP_ROOT, 'svc-ava', 'src');
  const files = walk(avaRoot);
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const codeOnly = stripCommentsAndStrings(content);
    if (!HARDCODED_URL_PATTERN.test(codeOnly)) {
      continue;
    }
    const rel = toRelative(file);
    if (!AVA_URL_ALLOWLIST.has(rel)) {
      violations.push({
        file: rel,
        reason: 'External URLs in svc-ava require explicit allowlist',
      });
    }
  }
}

function main() {
  const violations: Violation[] = [];

  checkPublicEndpoints(violations);
  checkBannedPatterns(violations);
  checkAvaExternalUrls(violations);

  if (violations.length === 0) {
    console.log('security bypass check: ok');
    return;
  }

  console.error('security bypass check failed');
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.reason}`);
  }
  process.exit(1);
}

main();
