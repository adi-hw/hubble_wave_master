#!/usr/bin/env ts-node
/**
 * Self-test for tools/security-bypass-check.ts (W0 task 3 / F105).
 *
 * Asserts:
 *   1. Scanner exits 0 against current master tree (allowlist matches reality).
 *   2. Scanner detects a planted @Public() controller not in PUBLIC_ALLOWLIST.
 *   3. Scanner ignores @Public() references that are inside comments
 *      (the abac.guard.ts pattern that previously false-positived).
 *   4. Scanner respects path normalization (the cross-platform bug
 *      where Windows local previously hid Linux-CI drift).
 *
 * Per scanner-self-test.ts contract: framework helpers are duplicated
 * here rather than imported (~70 lines), to avoid ts-node ESM
 * cross-file resolution pain. Tools are scripts, not application code.
 */

import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';

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

// ===========================================================================
// Tests
// ===========================================================================

const t = createSelfTest('security-bypass-check');

// -----------------------------------------------------------------------
// Test 1 — Master tree is clean (allowlist matches reality post-W0-task-3).
// -----------------------------------------------------------------------
{
  let exitCode = 0;
  let stdout = '';
  try {
    stdout = execSync('npm run security:check', {
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
    `scanner exits 0 against current master (got ${exitCode})`,
  );
  t.assert(
    /security bypass check: ok/.test(stdout),
    'scanner reports clean status',
  );
}

// -----------------------------------------------------------------------
// Test 2 — Planted @Public() controller in unallowlisted location fails.
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run security:check',
    fixturePath: 'apps/svc-data/src/app/__selftest_fixture__/sneaky.controller.ts',
    fixtureContent: `
import { Controller, Get } from '@nestjs/common';
import { Public } from '@hubblewave/auth-guard';

@Public()
@Controller('sneaky')
export class SneakyController {
  @Get()
  list() { return []; }
}
`,
  });
  t.assert(
    result.exitCode !== 0,
    `unallowlisted @Public() controller fails scanner (got exit ${result.exitCode})`,
  );
  t.assert(
    /sneaky\.controller\.ts/.test(result.stdout + result.stderr),
    'scanner output names the offending file',
  );
  t.assert(
    /Public endpoint requires allowlist approval/.test(result.stdout + result.stderr),
    'scanner reason matches the public-allowlist rule',
  );
}

// -----------------------------------------------------------------------
// Test 3 — @Public() referenced in comments is NOT a violation.
// (Models the abac.guard.ts pattern that previously false-positived.)
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run security:check',
    fixturePath: 'apps/svc-data/src/app/__selftest_fixture__/comment-ref.ts',
    fixtureContent: `
// This file references @Public() in comments only — it must NOT be
// detected as actually applying the decorator.
//
// Endpoints that opt out via @Public() bypass auth.
//
/**
 * @Public() is a legal decorator on auth controllers.
 */
export class CommentRefService {}
`,
  });
  t.assert(
    result.exitCode === 0,
    `commented @Public() references do NOT fail scanner (got exit ${result.exitCode})`,
  );
}

// -----------------------------------------------------------------------
// Test 4 — Decorator chain on one line (`@Public() @Get()`) is detected.
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run security:check',
    fixturePath: 'apps/svc-data/src/app/__selftest_fixture__/chained.controller.ts',
    fixtureContent: `
import { Controller, Get } from '@nestjs/common';
import { Public } from '@hubblewave/auth-guard';

@Controller('chain')
export class ChainedController {
  @Public() @Get('me')
  me() { return {}; }
}
`,
  });
  t.assert(
    result.exitCode !== 0,
    `chained-decorator @Public() is detected (got exit ${result.exitCode})`,
  );
}

t.report();
