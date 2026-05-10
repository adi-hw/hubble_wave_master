#!/usr/bin/env ts-node
/**
 * Scanner self-test framework + framework's own self-test (W0 task 2).
 *
 * Each architectural scanner under tools/ should ship with a self-test
 * that proves it catches the patterns it claims to catch. This file
 * provides the shared primitives (`runScannerOnFixture`, `createSelfTest`)
 * AND verifies that they themselves work (the bottom-of-file driver).
 *
 * Why a single file:
 *   ts-node + ESM in this repo has fragile cross-file `.ts` import
 *   resolution. Future per-scanner self-tests (Tasks 3, 4, 5, 10) each
 *   live in their own `tools/<scanner>-selftest.ts` and copy-paste the
 *   two helpers below or duplicate the small primitive — that is fine.
 *   The trade-off is sub-100-line duplication vs cross-module ESM pain.
 *   Tools are scripts, not application code.
 *
 * Usage from another self-test:
 *   import { runScannerOnFixture, createSelfTest } from './scanner-self-test.js';
 *   ...   // (works in CommonJS contexts; for ESM scripts in this repo,
 *         //  copy the two helpers — about 70 lines.)
 *
 * Run:
 *   npm run selftest:scanners
 */

import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';

// ===========================================================================
// Framework
// ===========================================================================

export interface ScannerSelfTestInput {
  /** npm script or absolute command (e.g., 'npm run security:check'). */
  scannerCommand: string;
  /** Fixture path relative to repo root (must NOT collide with real source). */
  fixturePath: string;
  /** Content written at fixturePath before the scanner runs. */
  fixtureContent: string;
  /** Optional extra cleanup paths beyond fixturePath itself. */
  alsoCleanup?: string[];
  /** Optional cwd override (defaults to process.cwd()). */
  cwd?: string;
}

export interface ScannerSelfTestResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function runScannerOnFixture(
  input: ScannerSelfTestInput,
): ScannerSelfTestResult {
  const cwd = input.cwd ?? process.cwd();
  const absPath = resolve(cwd, input.fixturePath);
  const fixtureDir = dirname(absPath);

  // Refuse to overwrite an existing real file. Self-tests must always
  // plant in synthetic locations; otherwise the test would silently
  // mutate real source.
  if (existsSync(absPath)) {
    throw new Error(
      `runScannerOnFixture refuses to overwrite existing file: ${absPath}. ` +
        `Choose a fixturePath that does not exist (e.g., under __selftest_fixture__/).`,
    );
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
    stdout =
      typeof err.stdout === 'string'
        ? err.stdout
        : err.stdout?.toString('utf-8') ?? '';
    stderr =
      typeof err.stderr === 'string'
        ? err.stderr
        : err.stderr?.toString('utf-8') ?? '';
  }

  // Cleanup — best-effort. Empty fixture dir is pruned; non-empty is left.
  try {
    rmSync(absPath, { force: true });
    for (const extra of input.alsoCleanup ?? []) {
      rmSync(resolve(cwd, extra), { recursive: true, force: true });
    }
    rmSync(fixtureDir, { recursive: false, force: true });
  } catch {
    // Tolerated. Next run overwrites.
  }

  return { exitCode, stdout, stderr };
}

export function createSelfTest(name: string): {
  assert: (condition: boolean, message: string) => void;
  report: () => void;
} {
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
// Self-tests for the framework itself (run when this file is invoked
// directly as `npm run selftest:scanners`).
// ===========================================================================

function runFrameworkSelfTests(): void {
  const t = createSelfTest('scanner-self-test framework');

  // -------------------------------------------------------------------
  // Test 1 — runScannerOnFixture cleans up regardless of scanner result.
  // Use cicd:check (fast, doesn't look at apps/, fixture is irrelevant).
  // -------------------------------------------------------------------
  const FIXTURE_OK = 'tools/__selftest_fixture__/probe-ok.ts';
  const result = runScannerOnFixture({
    scannerCommand: 'npm run cicd:check',
    fixturePath: FIXTURE_OK,
    fixtureContent: 'export const probe = "hello";',
  });

  t.assert(
    !existsSync(resolve(process.cwd(), FIXTURE_OK)),
    `fixture file removed after scanner run (${FIXTURE_OK})`,
  );
  t.assert(
    typeof result.exitCode === 'number',
    `exitCode captured as number (got ${typeof result.exitCode})`,
  );
  t.assert(
    result.exitCode === 0,
    `cicd:check returns 0 against neutral fixture (got ${result.exitCode})`,
  );
  t.assert(
    /CI\/CD wiring check: ok/.test(result.stdout),
    'cicd:check stdout contains success marker',
  );

  // -------------------------------------------------------------------
  // Test 2 — refuse to overwrite an existing file.
  // -------------------------------------------------------------------
  let threw = false;
  try {
    runScannerOnFixture({
      scannerCommand: 'true',
      fixturePath: 'tools/scanner-self-test.ts', // EXISTS
      fixtureContent: 'OVERWRITE_ATTEMPT',
    });
  } catch {
    threw = true;
  }
  t.assert(threw, 'overwrite of existing file is rejected with thrown error');

  const stillIntact = readFileSync(
    resolve(process.cwd(), 'tools/scanner-self-test.ts'),
    'utf-8',
  ).includes('runScannerOnFixture');
  t.assert(stillIntact, 'existing file content preserved after rejection');

  // -------------------------------------------------------------------
  // Test 3 — non-zero exit codes are captured correctly.
  // -------------------------------------------------------------------
  const failResult = runScannerOnFixture({
    scannerCommand: 'npm run __nonexistent_scanner_xyz__',
    fixturePath: 'tools/__selftest_fixture__/probe-fail.ts',
    fixtureContent: '// noop',
  });
  t.assert(
    failResult.exitCode !== 0,
    `non-zero exit captured for failing scanner (got ${failResult.exitCode})`,
  );

  t.report();
}

// Documented contract: this file is intended to be invoked directly via
// `npm run selftest:scanners`. Future per-scanner self-tests duplicate
// the two helpers above (~70 lines) rather than importing across .ts
// files, because ts-node ESM cross-file resolution is fragile in this
// repo. With that contract there's no import-vs-direct ambiguity to
// guard against — when this file runs, the self-tests run.
runFrameworkSelfTests();
