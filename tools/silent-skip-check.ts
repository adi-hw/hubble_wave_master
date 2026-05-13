import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Static-analysis check for canon §10 (silent-skip auditability clause).
 *
 * Canon §10 amendment: "Silent skips (logger.warn followed by `continue`) are
 * also auditability violations. They MUST also write a `runtime_anomaly` row via
 * `RuntimeAnomalyService` so operators can query and alert on them."
 *
 * This scanner flags `.service.ts` method bodies that contain BOTH:
 *   - `logger.warn(...)` or `logger.error(...)` (the "I noticed something bad" signal)
 *   - A `continue` statement (the "but I'm skipping this iteration" signal)
 *
 * AND do NOT contain any form of RuntimeAnomalyService write:
 *   - `runtimeAnomalyService.record(...)`, `anomalyService.record(...)`,
 *   - `this.<anyname>Anomaly.record(...)`, or `.create(...)` / `.save(...)` variants
 *
 * This is a heuristic scanner — false positives are acceptable and can be
 * allowlisted. False negatives (missed real violations) are the worse failure mode.
 *
 * A method body that has logger.warn/error AND continue but no RuntimeAnomalyService
 * call forces the author to either add the anomaly write or add an allowlist entry
 * with documented rationale — both outcomes improve auditability.
 */

type Violation = {
  file: string;
  reason: string;
};

const ROOTS = [join(process.cwd(), 'apps'), join(process.cwd(), 'libs')];
const TARGET_SUFFIXES = ['.service.ts'];
const IGNORE_DIRS = new Set(['__tests__', 'test', 'dist', 'tmp', 'node_modules']);

/**
 * Files explicitly known to contain silent-skip patterns that have been
 * accepted as deferred work. Listed by relative path. Each entry must be
 * accompanied by a follow-up reference (Wave/Fix/issue).
 */
const KNOWN_DEFERRED_OFFENDERS: Array<{ file: string; followUp: string }> = [
  // W5.G baseline inventory — first pass of silent-skip scanner. All sites below
  // contain logger.warn/error + continue in the same method body without a
  // RuntimeAnomalyService.record() call. Scheduled for W5.I sweep.
  //
  // NOTE: Some of these files DO use runtimeAnomaly.record() in OTHER methods,
  // but not in the specific method(s) that triggered the scanner (logger.warn +
  // continue without anomaly write in the same method body). Fixing each site
  // requires adding a RuntimeAnomalyService.record() call adjacent to the
  // continue statement, which is a service-file change deferred to W5.I.
  {
    file: 'apps/api/src/app/analytics/backup/backup.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/automation/runtime/automation-runtime.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/automation/runtime/script-sandbox.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/automation/workflow/workflow-action.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/ava/search/search-indexing.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/data/collection-data.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/data/computed/computed-property-dispatcher.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/data/defaults/default-value.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/data/formula/dependency.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/data/formula/lookup.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/data/formula/rollup.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/data/validation/validation.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/identity/auth/api-key/api-key.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/identity/auth/mfa.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/identity/auth/sso/oidc.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/identity/roles/permission-seeder.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/metadata/packs/packs.service.ts',
    followUp: 'W5.I',
  },
  {
    file: 'apps/api/src/app/notifications/notification-outbox-processor.service.ts',
    followUp: 'W5.I',
  },
  // enterprise lib — audit.service.ts uses logger.warn + continue but does not
  // have RuntimeAnomalyService injected. W5.I to evaluate whether to inject it
  // or refactor the pattern.
  {
    file: 'libs/enterprise/src/lib/audit.service.ts',
    followUp: 'W5.I',
  },
];

// Detects logger.warn or logger.error call in a method body.
export const LOGGER_WARN_PATTERN = /\blogger\s*\.\s*(?:warn|error)\s*\(/;

// Detects a bare `continue;` statement in a method body.
export const CONTINUE_PATTERN = /\bcontinue\s*;/;

// Detects any form of RuntimeAnomalyService write. Covers:
//   - this.runtimeAnomalyService.record(...)  — canonical injection name
//   - this.runtimeAnomaly.record(...)          — shortened injection name (common in codebase)
//   - this.anomalyService.record(...)
//   - this.<any name ending in Anomaly or AnomalyService>.record(...)
//   - bare identifiers without `this.`: runtimeAnomalyService.record(...)
//   - .save(...) or .create(...) variants in case the service is injected differently
export const RUNTIME_ANOMALY_WRITE_PATTERN =
  /(?:runtimeAnomalyService|runtimeAnomaly|anomalyService|(?:this\.[A-Za-z_$][\w$]*[Aa]nomaly(?:[A-Za-z_$][\w$]*)?))\s*\.\s*(?:record|save|create)\s*\(/;

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

/**
 * Splits a TypeScript file into top-level method bodies. Reuses the same
 * brace-matching extraction logic from audit-bypass-check.ts — extract any
 * method-like structure (async, public/private/protected, etc.) and return
 * the body between the opening and closing braces.
 *
 * Exported for use by the self-test suite.
 */
export function extractMethodBodies(content: string): string[] {
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

/**
 * Returns true if a method body contains both a logger.warn/error call AND a
 * `continue;` statement, WITHOUT any RuntimeAnomalyService write.
 *
 * Exported for use by the self-test suite.
 */
export function methodHasSilentSkip(methodBody: string): boolean {
  const hasLoggerWarn = LOGGER_WARN_PATTERN.test(methodBody);
  if (!hasLoggerWarn) return false;

  const hasContinue = CONTINUE_PATTERN.test(methodBody);
  if (!hasContinue) return false;

  const hasAnomalyWrite = RUNTIME_ANOMALY_WRITE_PATTERN.test(methodBody);
  if (hasAnomalyWrite) return false;

  return true;
}

function analyzeFile(file: string): Violation[] {
  const content = readFileSync(file, 'utf8');
  if (isDeferred(file)) {
    return [];
  }

  const methods = extractMethodBodies(content);
  const violations: Violation[] = [];

  for (const body of methods) {
    if (methodHasSilentSkip(body)) {
      const firstLineMatch = body.match(/^[\s\S]{0,200}/);
      const snippet = (firstLineMatch?.[0] ?? '').replace(/\s+/g, ' ').slice(0, 120);
      violations.push({
        file,
        reason: `logger.warn/error + continue in method body without RuntimeAnomalyService.record(). Snippet: ${snippet}...`,
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
    console.log('silent-skip check: ok');
    if (KNOWN_DEFERRED_OFFENDERS.length > 0) {
      console.log(`  (${KNOWN_DEFERRED_OFFENDERS.length} deferred site(s) tracked):`);
      for (const entry of KNOWN_DEFERRED_OFFENDERS) {
        console.log(`    - ${entry.file}  [${entry.followUp}]`);
      }
    }
    return;
  }

  console.error('silent-skip check failed');
  console.error('Each listed file contains a method body with logger.warn/error + continue');
  console.error('but NO RuntimeAnomalyService.record() call. Per canon §10 amendment:');
  console.error('"Silent skips are auditability violations — they MUST write a');
  console.error('runtime_anomaly row via RuntimeAnomalyService so operators can');
  console.error('query and alert on them."');
  console.error('');
  console.error('Fix: add `await this.runtimeAnomalyService.record({ kind, serviceCode, message })`');
  console.error('before the `continue;` statement, or add to KNOWN_DEFERRED_OFFENDERS');
  console.error('with a followUp tag if the fix is deferred to a later wave.');
  console.error('');
  for (const violation of violations) {
    console.error(`- ${relPath(violation.file)}`);
    console.error(`    ${violation.reason}`);
  }
  process.exit(1);
}

// Guard so that direct `ts-node` invocation runs main(), but imports by the
// self-test suite do not trigger a scan of the whole repo.
const isMainModule =
  typeof require !== 'undefined'
    ? require.main === module
    : process.argv[1]?.includes('silent-skip-check') ?? false;

if (isMainModule) {
  main();
}
