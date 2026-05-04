import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Static-analysis check for canon §10 (every action must be explainable).
 *
 * Flags service files that issue a state-changing repository write and a
 * separate audit-log write OUTSIDE a `withAudit(...)` or
 * `dataSource.transaction(...)` block. Such code paths leave audit gaps when
 * the process is killed between the two writes.
 *
 * This is a best-effort heuristic, not a full AST analysis. It is intended
 * to catch the obvious cases shipped by W1.6 and prevent regressions.
 */

type Violation = {
  file: string;
  reason: string;
};

const ROOTS = [join(process.cwd(), 'apps'), join(process.cwd(), 'libs')];
const TARGET_SUFFIXES = ['.service.ts'];
const IGNORE_DIRS = new Set(['__tests__', 'test', 'dist', 'tmp', 'node_modules']);

/**
 * Files explicitly known to contain audit-write patterns that have been
 * accepted as deferred work. Listed by relative path. Each entry must be
 * accompanied by a follow-up reference (Wave/Fix/issue).
 */
const KNOWN_DEFERRED_OFFENDERS: Array<{ file: string; followUp: string }> = [];

const AUDIT_WRITE_PATTERNS = [
  /\bauditLog(?:Repo|Repository)?\s*\.\s*save\s*\(/,
  /\.\s*save\s*\(\s*[^)]*\bauditLog\b/i,
  /\bwriteAuditLog\s*\(/,
  /\bgetRepository\s*\(\s*AuditLog\s*\)/,
];

const RECORD_WRITE_PATTERNS = [
  /\b(?:Repo|Repository|repo|repository)\s*\.\s*save\s*\(/,
  /\bcreateQueryBuilder\s*\(\s*\)\s*\.\s*(?:insert|update|delete)\s*\(/,
];

const TRANSACTIONAL_WRAPPER_PATTERNS = [
  /\bwithAudit\s*\(/,
  /\bdataSource\s*\.\s*transaction\s*\(/,
  /\bmanager\s*\.\s*transaction\s*\(/,
  /\bentityManager\s*\.\s*transaction\s*\(/,
];

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
    if (TARGET_SUFFIXES.some((suffix) => fullPath.endsWith(suffix))) {
      files.push(fullPath);
    }
  }
  return files;
}

function relPath(absolute: string): string {
  return absolute.replace(process.cwd() + '\\', '').replace(process.cwd() + '/', '').replace(/\\/g, '/');
}

function isDeferred(file: string): boolean {
  const rel = relPath(file);
  return KNOWN_DEFERRED_OFFENDERS.some((entry) => rel.endsWith(entry.file));
}

function hasAnyMatch(content: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(content));
}

/**
 * Scan one method body. Returns true if the method contains both
 * a record-mutation save and an audit save outside a transactional wrapper.
 */
function methodHasUnsafePattern(methodBody: string): boolean {
  const hasAuditWrite = hasAnyMatch(methodBody, AUDIT_WRITE_PATTERNS);
  if (!hasAuditWrite) return false;

  const hasRecordWrite = hasAnyMatch(methodBody, RECORD_WRITE_PATTERNS);
  if (!hasRecordWrite) return false;

  const hasWrapper = hasAnyMatch(methodBody, TRANSACTIONAL_WRAPPER_PATTERNS);
  if (hasWrapper) return false;

  return true;
}

/**
 * Splits a TypeScript file into top-level method bodies. We find a `{`
 * after a likely method signature and walk to the matching `}`. This is a
 * crude scan that misses some patterns but is enough to catch the obvious
 * bug pattern of "save then write audit in the same method body".
 */
function extractMethodBodies(content: string): string[] {
  const methods: string[] = [];
  const re = /(?:async\s+)?(?:public|private|protected\s+)?(?:async\s+)?[\w$]+\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const start = match.index + match[0].length - 1;
    let depth = 1;
    let i = start + 1;
    while (i < content.length && depth > 0) {
      const ch = content[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '/' && content[i + 1] === '/') {
        // skip line comment
        while (i < content.length && content[i] !== '\n') i++;
        continue;
      } else if (ch === '/' && content[i + 1] === '*') {
        // skip block comment
        i += 2;
        while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) i++;
        i += 2;
        continue;
      } else if (ch === '"' || ch === "'" || ch === '`') {
        const quote = ch;
        i++;
        while (i < content.length && content[i] !== quote) {
          if (content[i] === '\\') i += 2;
          else i++;
        }
      }
      i++;
    }
    if (depth === 0) {
      methods.push(content.slice(start, i));
    }
  }
  return methods;
}

function analyzeFile(file: string): Violation[] {
  const content = readFileSync(file, 'utf8');
  if (isDeferred(file)) {
    return [];
  }

  const methods = extractMethodBodies(content);
  const violations: Violation[] = [];

  for (const body of methods) {
    if (methodHasUnsafePattern(body)) {
      const firstLineMatch = body.match(/^[\s\S]{0,200}/);
      const snippet = (firstLineMatch?.[0] ?? '').replace(/\s+/g, ' ').slice(0, 120);
      violations.push({
        file,
        reason: `Save-then-audit pattern outside withAudit/transaction wrapper. Snippet: ${snippet}...`,
      });
      // Only report once per file to avoid noise.
      break;
    }
  }

  return violations;
}

function main() {
  const allFiles: string[] = [];
  for (const root of ROOTS) {
    walk(root, allFiles);
  }

  const violations: Violation[] = [];
  for (const file of allFiles) {
    violations.push(...analyzeFile(file));
  }

  if (violations.length === 0) {
    console.log('audit bypass check: ok');
    if (KNOWN_DEFERRED_OFFENDERS.length > 0) {
      console.log(`  (${KNOWN_DEFERRED_OFFENDERS.length} deferred site(s) tracked):`);
      for (const entry of KNOWN_DEFERRED_OFFENDERS) {
        console.log(`    - ${entry.file}  [${entry.followUp}]`);
      }
    }
    return;
  }

  console.error('audit bypass check failed');
  console.error('Each listed file performs a state-changing save AND an audit-log');
  console.error('save in the same method WITHOUT a withAudit(...) or');
  console.error('dataSource.transaction(...) wrapper. Wrap both writes in one');
  console.error('transaction so that a process crash between them cannot leave');
  console.error('the mutation persisted with no audit trail (canon §10).');
  console.error('');
  for (const violation of violations) {
    console.error(`- ${relPath(violation.file)}`);
    console.error(`    ${violation.reason}`);
  }
  process.exit(1);
}

main();
