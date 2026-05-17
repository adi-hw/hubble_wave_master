import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
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
  //   Per-area routes: /<area>/health for each sub-module of apps/api.
  //   Identity keeps the canonical /health (HealthController).
  //   apps/control-plane has its own /health-aggregator/health surface.
  // -------------------------------------------------------------------
  'apps/control-plane/src/app/health-aggregator/health-aggregator.controller.ts',
  'apps/api/src/app/data/data-health.controller.ts',
  'apps/api/src/app/identity/health.controller.ts',
  'apps/api/src/app/metadata/metadata-health.controller.ts',
  'apps/api/src/app/automation/automation-health.controller.ts',
  'apps/api/src/app/ava/ava-health.controller.ts',
  'apps/api/src/app/views/views-health.controller.ts',
  'apps/api/src/app/notifications/notifications-health.controller.ts',
  'apps/api/src/app/instance-api/instance-api-health.controller.ts',
  'apps/api/src/app/analytics/analytics-health.controller.ts',
  // -------------------------------------------------------------------
  // Category 2: Authentication entry points.
  // -------------------------------------------------------------------
  'apps/control-plane/src/app/auth/auth.controller.ts',
  // Plan Fix 29 (§29.9): parallel HS256 path deleted; replaced by this
  // thin alias that delegates to the canonical ES256 AuthService.
  'apps/api/src/app/instance-api/identity/auth/identity-auth-alias.controller.ts',
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
  'apps/control-plane/src/app/packs/packs.catalog.controller.ts',
  // theme read endpoints render on the unauthenticated login page; the
  // controller has @Public on individual GET routes only — POST/PUT/
  // DELETE remain auth-required (verified at theme.controller.ts).
  'apps/api/src/app/metadata/theme/theme.controller.ts',
  // -------------------------------------------------------------------
  // Category 4: OAuth / OIDC integration callbacks (IdP-initiated).
  // -------------------------------------------------------------------
  'apps/api/src/app/data/integration/oauth2.controller.ts',
  // Inbound webhook trigger for process flows (canon §28 / W2 Stream 3
  // Task 24). Authentication is X-Webhook-Secret header (timing-safe
  // compare against the flow definition's stored secret). External
  // systems call this — not platform users — so @Public() is the
  // right route-level decorator; the webhook-secret check inside the
  // handler is the authoritative authentication boundary.
  'apps/api/src/app/automation/workflow/workflow-webhook.controller.ts',
  // -------------------------------------------------------------------
  // Category 6: JWKS publication (canon §29.2).
  // RFC 7517 JWKS endpoint — relying parties fetch our public signing
  // keys to verify our JWTs. Intentionally unauthenticated; only
  // exposes the `active` + `retiring` public keys, never private
  // material or KMS identifiers.
  // -------------------------------------------------------------------
  'apps/api/src/app/identity/auth/jwks.controller.ts',
  // Control-plane companion (canon §18 carve-out + §29.2). Same RFC 7517
  // posture, separate key per plane. Added by Stream 1 PR3.
  'apps/control-plane/src/app/auth/jwks.controller.ts',
  // -------------------------------------------------------------------
  // Category 7: Service-token bootstrap mint endpoint (canon §29.7).
  // POST /internal/service-token bypasses JwtAuthGuard because the
  // caller has no HubbleWave JWT yet — they exchange a K8s projected
  // SA token (production) or X-Bootstrap-Secret header (dev) for one.
  // ServiceBootstrapService authenticates the request internally
  // before the token is minted; @Public() only opts out of the global
  // JWT chain.
  // -------------------------------------------------------------------
  'apps/api/src/app/identity/auth/service-token.controller.ts',
  // -------------------------------------------------------------------
  // Category 5: Auth handled by a dedicated guard (PackInstallGuard).
  // -------------------------------------------------------------------
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
      'apps/api/src/app/ava/embedding.controller.ts',
      // backup.service.ts uses client.eval() for the Redis distributed lock
      // (same Lua-on-server-side pattern as ava embedding).
      'apps/api/src/app/analytics/backup/backup.service.ts',
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
      // backup.service.ts uses spawn() exclusively for pg_dump and pg_restore.
      // These are approved infrastructure utilities; the command is hardcoded
      // and no user input flows into args.
      'apps/api/src/app/analytics/backup/backup.service.ts',
      'apps/control-plane/src/app/terraform/terraform.executor.ts',
    ]),
  },
];

const AVA_URL_ALLOWLIST = new Set([
  'apps/api/src/main.ts',
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
 * Files like `apps/api/src/app/identity/abac/abac.guard.ts` reference
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
  const avaRoot = join(APP_ROOT, 'api', 'src', 'app', 'ava');
  if (!existsSync(avaRoot)) {
    return;
  }
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
        reason: 'External URLs in apps/api/src/app/ava require explicit allowlist',
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
