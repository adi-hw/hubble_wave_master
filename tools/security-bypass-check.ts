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

const PUBLIC_ALLOWLIST = new Set([
  'apps/svc-control-plane/src/app/auth/auth.controller.ts',
  'apps/svc-control-plane/src/app/packs/packs.catalog.controller.ts',
  'apps/svc-data/src/app/integration/oauth2.controller.ts',
  'apps/svc-identity/src/app/health.controller.ts',
  'apps/svc-identity/src/app/auth/auth.controller.ts',
  'apps/svc-identity/src/app/auth/password-reset.controller.ts',
  'apps/svc-identity/src/app/auth/email-verification.controller.ts',
  'apps/svc-identity/src/app/auth/sso/sso.controller.ts',
  'apps/svc-identity/src/app/auth/sso/sso-config.controller.ts',
]);

const BANNED_PATTERNS: Array<{
  pattern: RegExp;
  description: string;
  allowlist?: Set<string>;
}> = [
  {
    pattern: /\beval\s*\(/,
    description: 'eval() is not allowed',
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

function checkPublicEndpoints(violations: Violation[]) {
  const files = walk(APP_ROOT).filter((file) => file.includes('/src/app/'));
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (!content.includes('@Public()')) {
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

function checkAvaExternalUrls(violations: Violation[]) {
  const avaRoot = join(APP_ROOT, 'svc-ava', 'src');
  const files = walk(avaRoot);
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (!/https?:\/\//.test(content)) {
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
