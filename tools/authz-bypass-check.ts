import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

type Violation = {
  file: string;
  reason: string;
};

const ROOT = join(process.cwd(), 'apps', 'svc-data', 'src', 'app');
const TARGET_SUFFIX = '.service.ts';
const IGNORE_DIRS = new Set(['__tests__', 'test', 'dist', 'tmp']);

const NEEDS_AUTHZ_PATTERNS = [
  /RequestContext/,
];

const DATA_ACCESS_PATTERNS = [
  /createQueryBuilder/,
  /getRepository\(/,
  /\.query\(/,
  /\bDataSource\b/,
];

const AUTHZ_USAGE_PATTERNS = [
  /\bauthz\./,
  /AuthorizationService/,
  /ensureTableAccess\(/,
  /buildRowLevelClause\(/,
];

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
    if (fullPath.endsWith(TARGET_SUFFIX)) {
      files.push(fullPath);
    }
  }
  return files;
}

function fileNeedsAuthz(content: string): boolean {
  return NEEDS_AUTHZ_PATTERNS.some((pattern) => pattern.test(content))
    && DATA_ACCESS_PATTERNS.some((pattern) => pattern.test(content));
}

function fileUsesAuthz(content: string): boolean {
  return AUTHZ_USAGE_PATTERNS.some((pattern) => pattern.test(content));
}

function main() {
  const files = walk(ROOT);
  const violations: Violation[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (!fileNeedsAuthz(content)) {
      continue;
    }
    if (!fileUsesAuthz(content)) {
      violations.push({
        file,
        reason: 'Missing AuthorizationService usage for RequestContext-based data access.',
      });
    }
  }

  if (violations.length === 0) {
    console.log('authz bypass check: ok');
    return;
  }

  console.error('authz bypass check failed');
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.reason}`);
  }
  process.exit(1);
}

main();
