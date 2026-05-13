#!/usr/bin/env ts-node
/**
 * Self-test for tools/audit-bypass-check.ts (W5.A / Plan Fix 25 / F044).
 *
 * Tests two surfaces:
 *   A. Direct unit tests against the core analysis logic using synthetic TS
 *      string fixtures. These assert the widened regex (W5.A: <varName>Repo.save /
 *      <varName>Repository.save patterns that the original leading `\b` word-boundary
 *      missed). The scanner exports `methodHasUnsafePattern`, `extractMethodBodies`,
 *      and `REPO_SAVE_PATTERN`; this suite mirrors those exported functions inline
 *      to avoid ts-node ESM cross-file resolution issues (per scanner-self-test.ts
 *      contract: framework helpers are duplicated, not imported).
 *   B. Integration tests via `execSync` that plant fixture files and run
 *      `npm run audit:check` to confirm end-to-end scanner behaviour.
 *
 * Required assertions (from task spec):
 *   Positive-1: sessionRepo.save(s) + auditLogRepo.save(a) in one method body,
 *               no wrapper → flagged
 *   Positive-2: userRepo.save() + auditLog.save() in one method body → flagged
 *   Negative-1: same pattern inside withAudit(...) → NOT flagged
 *   Negative-2: same pattern inside dataSource.transaction(...) → NOT flagged
 *   Negative-3: same pattern inside manager.transaction(...) → NOT flagged
 *   Negative-4: only sessionRepo.save() with no audit write → NOT flagged
 *   Negative-5: only auditLogRepo.save() with no record write → NOT flagged
 *   Negative-6: // sessionRepo.save() + auditLogRepo.save() comment-only → NOT flagged
 *   Integration-1: master tree is clean after W5.A allowlist is populated
 *   Integration-2: planted unsafe fixture in identity area is caught
 *   Integration-3: planted safe fixture (wrapped in withAudit) is accepted
 *
 * Per scanner-self-test.ts contract: framework helpers are duplicated here
 * rather than imported to avoid ts-node ESM cross-file resolution issues.
 */

import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';

// ---------------------------------------------------------------------------
// Inlined scanner logic (mirrors audit-bypass-check.ts exported functions)
// — kept in sync manually; the scanner exports these for documentation, but
//   cross-file ESM imports are not viable in the tools/ ts-node environment.
// ---------------------------------------------------------------------------

const AUDIT_WRITE_PATTERNS_TEST = [
  /\bauditLog(?:Repo|Repository)?\s*\.\s*save\s*\(/,
  /\.\s*save\s*\(\s*[^)]*\bauditLog\b/i,
  /\bwriteAuditLog\s*\(/,
  /\bgetRepository\s*\(\s*AuditLog\s*\)/,
];

// Matches any identifier ending in Repo or Repository followed by .save(.
// This is the widened pattern (W5.A fix): the original used /\b(?:Repo|...)/ which
// missed mid-identifier occurrences like sessionRepo, userRepo, auditLogRepo.
const REPO_SAVE_PATTERN_TEST = /[A-Za-z_$][\w$]*[Rr]epo(?:sitory)?\s*\.\s*save\s*\(/g;

// Audit-log repo names are excluded from the RECORD_WRITE check (they are captured
// by AUDIT_WRITE_PATTERNS already; double-counting them as record writes would
// false-positive on methods that write only to the audit repo).
const AUDIT_REPO_NAME_PATTERN_TEST = /^(?:this\.)?auditLog(?:Repo|Repository)?\s*\./i;

const RECORD_WRITE_EXTRA_PATTERNS_TEST = [
  /\bcreateQueryBuilder\s*\(\s*\)\s*\.\s*(?:insert|update|delete)\s*\(/,
];

const TRANSACTIONAL_WRAPPER_PATTERNS_TEST = [
  /\bwithAudit\s*\(/,
  /\bdataSource\s*\.\s*transaction\s*\(/,
  /\bmanager\s*\.\s*transaction\s*\(/,
  /\bentityManager\s*\.\s*transaction\s*\(/,
];

function hasNonAuditRepoSaveTest(methodBody: string): boolean {
  const pattern = new RegExp(REPO_SAVE_PATTERN_TEST.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(methodBody)) !== null) {
    if (!AUDIT_REPO_NAME_PATTERN_TEST.test(match[0])) {
      return true;
    }
  }
  return false;
}

function methodHasUnsafePatternTest(methodBody: string): boolean {
  const hasAuditWrite = AUDIT_WRITE_PATTERNS_TEST.some((p) => p.test(methodBody));
  if (!hasAuditWrite) return false;

  const hasRecordWrite =
    RECORD_WRITE_EXTRA_PATTERNS_TEST.some((p) => p.test(methodBody)) ||
    hasNonAuditRepoSaveTest(methodBody);
  if (!hasRecordWrite) return false;

  const hasWrapper = TRANSACTIONAL_WRAPPER_PATTERNS_TEST.some((p) => p.test(methodBody));
  return !hasWrapper;
}

function extractMethodBodiesTest(content: string): string[] {
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
        while (i < content.length && content[i] !== '\n') i++;
        continue;
      } else if (ch === '/' && content[i + 1] === '*') {
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

// ---------------------------------------------------------------------------
// Shared helpers (duplicated per contract)
// ---------------------------------------------------------------------------

interface ScannerSelfTestInput {
  scannerCommand: string;
  fixturePath: string;
  fixtureContent: string;
  alsoCleanup?: string[];
  cwd?: string;
}

interface ScannerSelfTestResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runScannerOnFixture(input: ScannerSelfTestInput): ScannerSelfTestResult {
  const cwd = input.cwd ?? process.cwd();
  const absPath = resolve(cwd, input.fixturePath);
  const fixtureDir = dirname(absPath);
  if (existsSync(absPath)) {
    throw new Error(`refuses to overwrite existing file: ${absPath}`);
  }
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(absPath, input.fixtureContent, 'utf-8');

  let stdout = '';
  let stderr = '';
  let exitCode = 0;
  try {
    stdout = execSync(input.scannerCommand, {
      encoding: 'utf-8',
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer };
    exitCode = err.status ?? 1;
    stdout = typeof err.stdout === 'string' ? err.stdout : err.stdout?.toString('utf-8') ?? '';
    stderr = typeof err.stderr === 'string' ? err.stderr : err.stderr?.toString('utf-8') ?? '';
  }
  try {
    rmSync(absPath, { force: true });
    for (const extra of input.alsoCleanup ?? []) {
      rmSync(resolve(cwd, extra), { recursive: true, force: true });
    }
    rmSync(fixtureDir, { recursive: false, force: true });
  } catch {
    // tolerated
  }
  return { exitCode, stdout, stderr };
}

function createSelfTest(name: string) {
  const failures: string[] = [];
  let passed = 0;
  return {
    assert(condition: boolean, message: string) {
      if (condition) {
        passed += 1;
        console.log(`  PASS  ${message}`);
      } else {
        failures.push(message);
        console.error(`  FAIL  ${message}`);
      }
    },
    report() {
      const total = passed + failures.length;
      console.log(`\n[${name}] ${passed}/${total} assertions passed.`);
      if (failures.length > 0) {
        console.error(`[${name}] FAILED (${failures.length}):`);
        for (const f of failures) console.error(`  - ${f}`);
        process.exit(1);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Synthetic fixture helpers
// ---------------------------------------------------------------------------

function wrapInMethod(body: string): string {
  return `async doWork() {\n${body}\n}`;
}

function wrapInWithAudit(body: string): string {
  return `async doWork() {
  await withAudit(dataSource, async (mgr, recordAudit) => {
    ${body}
  });
}`;
}

function wrapInDataSourceTransaction(body: string): string {
  return `async doWork() {
  await dataSource.transaction(async (mgr) => {
    ${body}
  });
}`;
}

function wrapInManagerTransaction(body: string): string {
  return `async doWork() {
  await manager.transaction(async () => {
    ${body}
  });
}`;
}

const UNSAFE_BODY_SESSION = `
  const session = this.sessionRepo.create({ userId });
  await this.sessionRepo.save(session);
  await this.authEventsService.record({ userId, eventType: 'login' });
  await this.auditLogRepo.save(this.auditLogRepo.create({ action: 'login', userId }));
`;

const UNSAFE_BODY_USER = `
  const user = await this.userRepo.findOne({ where: { id: userId } });
  user.name = name;
  await this.userRepo.save(user);
  await this.auditLog.save({ action: 'update', userId });
`;

// ---------------------------------------------------------------------------
// Part A — Unit tests using inlined scanner logic + synthetic fixtures
// ---------------------------------------------------------------------------

const t = createSelfTest('audit-bypass-check');

console.log('\n--- Part A: unit tests on methodHasUnsafePattern (inlined logic) ---\n');

// -----------------------------------------------------------------------
// Positive-1: sessionRepo.save + auditLogRepo.save in same method, no wrapper
// -----------------------------------------------------------------------
{
  const bodies = extractMethodBodiesTest(wrapInMethod(UNSAFE_BODY_SESSION));
  const flagged = bodies.some(methodHasUnsafePatternTest);
  t.assert(
    flagged,
    'Positive-1: sessionRepo.save + auditLogRepo.save in one method without wrapper → flagged',
  );
}

// -----------------------------------------------------------------------
// Positive-2: userRepo.save + auditLog.save in same method, no wrapper
// -----------------------------------------------------------------------
{
  const bodies = extractMethodBodiesTest(wrapInMethod(UNSAFE_BODY_USER));
  const flagged = bodies.some(methodHasUnsafePatternTest);
  t.assert(
    flagged,
    'Positive-2: userRepo.save + auditLog.save in one method without wrapper → flagged',
  );
}

// -----------------------------------------------------------------------
// Negative-1: same pattern inside withAudit(...)
// -----------------------------------------------------------------------
{
  const bodies = extractMethodBodiesTest(wrapInWithAudit(UNSAFE_BODY_SESSION));
  const flagged = bodies.some(methodHasUnsafePatternTest);
  t.assert(
    !flagged,
    'Negative-1: sessionRepo.save + auditLogRepo.save inside withAudit → NOT flagged',
  );
}

// -----------------------------------------------------------------------
// Negative-2: same pattern inside dataSource.transaction(...)
// -----------------------------------------------------------------------
{
  const bodies = extractMethodBodiesTest(wrapInDataSourceTransaction(UNSAFE_BODY_SESSION));
  const flagged = bodies.some(methodHasUnsafePatternTest);
  t.assert(
    !flagged,
    'Negative-2: sessionRepo.save + auditLogRepo.save inside dataSource.transaction → NOT flagged',
  );
}

// -----------------------------------------------------------------------
// Negative-3: same pattern inside manager.transaction(...)
// -----------------------------------------------------------------------
{
  const bodies = extractMethodBodiesTest(wrapInManagerTransaction(UNSAFE_BODY_SESSION));
  const flagged = bodies.some(methodHasUnsafePatternTest);
  t.assert(
    !flagged,
    'Negative-3: sessionRepo.save + auditLogRepo.save inside manager.transaction → NOT flagged',
  );
}

// -----------------------------------------------------------------------
// Negative-4: only sessionRepo.save(), no audit write present
// -----------------------------------------------------------------------
{
  const bodies = extractMethodBodiesTest(wrapInMethod(`
    const session = this.sessionRepo.create({ userId });
    await this.sessionRepo.save(session);
  `));
  const flagged = bodies.some(methodHasUnsafePatternTest);
  t.assert(
    !flagged,
    'Negative-4: only sessionRepo.save() with no audit write → NOT flagged',
  );
}

// -----------------------------------------------------------------------
// Negative-5: only auditLogRepo.save(), no record write present
// -----------------------------------------------------------------------
{
  const bodies = extractMethodBodiesTest(wrapInMethod(`
    await this.auditLogRepo.save(this.auditLogRepo.create({ action: 'read', userId }));
  `));
  const flagged = bodies.some(methodHasUnsafePatternTest);
  t.assert(
    !flagged,
    'Negative-5: only auditLogRepo.save() with no record write → NOT flagged',
  );
}

// -----------------------------------------------------------------------
// Negative-6: comment-only references at file level (no method body extracted)
//
// The scanner extracts METHOD BODIES via brace-matching. A file-level block
// comment does not produce any method body, so `extractMethodBodies` returns
// an empty array and no pattern can ever match. This is the canonical
// negative case: the patterns appear only in comments OUTSIDE any method.
// -----------------------------------------------------------------------
{
  const fileContent = `
// sessionRepo.save() + auditLogRepo.save() are mentioned here but outside any method.
/**
 * @example
 *   sessionRepo.save(session);
 *   auditLogRepo.save(log);
 */
export class CommentOnlyService {}
`;
  const bodies = extractMethodBodiesTest(fileContent);
  const flagged = bodies.some(methodHasUnsafePatternTest);
  t.assert(
    !flagged,
    'Negative-6: comment-only references at file level (no method bodies) → NOT flagged',
  );
}

// ---------------------------------------------------------------------------
// Part B — Integration tests via execSync
// ---------------------------------------------------------------------------

console.log('\n--- Part B: integration tests via npm run audit:check ---\n');

// -----------------------------------------------------------------------
// Integration-1: Master tree is clean (allowlist matches reality post-W5.A).
// -----------------------------------------------------------------------
{
  let exitCode = 0;
  let stdout = '';
  try {
    stdout = execSync('npm run audit:check', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string };
    exitCode = err.status ?? 1;
    stdout = err.stdout ?? '';
  }
  t.assert(
    exitCode === 0,
    `Integration-1: scanner exits 0 against current master (got ${exitCode})`,
  );
  t.assert(
    /audit bypass check: ok/.test(stdout),
    'Integration-1: scanner reports clean status',
  );
  t.assert(
    /4 deferred site/.test(stdout),
    'Integration-1: scanner lists 4 deferred W5.B sites',
  );
}

// -----------------------------------------------------------------------
// Integration-2: A planted unsafe file in identity area is caught.
// The fixture adds a NEW file not in KNOWN_DEFERRED_OFFENDERS, so it
// must trigger a violation even though other identity files are deferred.
// -----------------------------------------------------------------------
{
  const UNSAFE_FIXTURE = `
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class PlantedUnsafeService {
  constructor(
    private readonly sessionRepo: Repository<any>,
    private readonly auditLogRepo: Repository<any>,
  ) {}

  async doUnsafeWrite(userId: string): Promise<void> {
    const session = this.sessionRepo.create({ userId });
    await this.sessionRepo.save(session);
    await this.auditLogRepo.save(this.auditLogRepo.create({ action: 'login', userId }));
  }
}
`;
  const result = runScannerOnFixture({
    scannerCommand: 'npm run audit:check',
    fixturePath:
      'apps/api/src/app/identity/__selftest_fixture__/planted-unsafe.service.ts',
    fixtureContent: UNSAFE_FIXTURE,
  });
  t.assert(
    result.exitCode !== 0,
    `Integration-2: planted unsafe service in identity area fails scanner (got exit ${result.exitCode})`,
  );
  t.assert(
    /planted-unsafe\.service\.ts/.test(result.stdout + result.stderr),
    'Integration-2: scanner output names the offending fixture file',
  );
}

// -----------------------------------------------------------------------
// Integration-3: A planted safe file (wrapped in withAudit) is accepted.
// -----------------------------------------------------------------------
{
  const SAFE_FIXTURE = `
import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { withAudit } from '@hubblewave/instance-db';

@Injectable()
export class PlantedSafeService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sessionRepo: Repository<any>,
    private readonly auditLogRepo: Repository<any>,
  ) {}

  async doSafeWrite(userId: string): Promise<void> {
    await withAudit(this.dataSource, async (mgr, recordAudit) => {
      const session = mgr.getRepository('Session').create({ userId });
      await mgr.getRepository('Session').save(session);
      recordAudit({ action: 'login', userId });
    });
  }
}
`;
  const result = runScannerOnFixture({
    scannerCommand: 'npm run audit:check',
    fixturePath:
      'apps/api/src/app/identity/__selftest_fixture__/planted-safe.service.ts',
    fixtureContent: SAFE_FIXTURE,
  });
  t.assert(
    result.exitCode === 0,
    `Integration-3: planted safe service (withAudit-wrapped) is accepted (got exit ${result.exitCode})`,
  );
}

t.report();
