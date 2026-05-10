#!/usr/bin/env ts-node
/**
 * Self-test for tools/authz-bypass-check.ts (W0 task 4 / F018).
 *
 * Asserts:
 *   1. Scanner exits 0 against current master (allowlist matches reality).
 *   2. Planted RequestContext+DataSource bypass in svc-insights fails.
 *   3. Planted bypass in svc-ava (was previously unscanned) fails.
 *   4. Planted bypass in svc-workflow (was previously unscanned) fails.
 *   5. RequestContext+DataSource WITH AuthorizationService is OK.
 *   6. svc-control-plane is INTENTIONALLY not scanned (canon §18 carve-out).
 *
 * Per scanner-self-test.ts contract: framework helpers are duplicated
 * here.
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

const BYPASS_FIXTURE_BODY = `
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface RequestContext { userId: string; }

@Injectable()
export class BadService {
  constructor(private ds: DataSource) {}

  async leak(ctx: RequestContext) {
    return this.ds
      .createQueryBuilder()
      .from('users', 'u')
      .where('1=1')
      .getRawMany();
  }
}
`;

const SAFE_FIXTURE_BODY = `
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthorizationService } from '@hubblewave/authorization';

interface RequestContext { userId: string; }

@Injectable()
export class SafeService {
  constructor(
    private ds: DataSource,
    private authz: AuthorizationService,
  ) {}

  async readOne(ctx: RequestContext, recordId: string) {
    await this.authz.ensureCollectionAccess(ctx, 'records', 'read');
    return this.ds.getRepository('records').findOne({ where: { id: recordId } });
  }
}
`;

const t = createSelfTest('authz-bypass-check');

// -----------------------------------------------------------------------
// Test 1 — Master tree clean.
// -----------------------------------------------------------------------
{
  let exitCode = 0;
  let stdout = '';
  try {
    stdout = execSync('npm run authz:check', {
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
    /authz bypass check: ok/.test(stdout),
    'scanner reports clean status',
  );
}

// -----------------------------------------------------------------------
// Test 2 — Planted bypass in svc-insights (was previously F146-tracked
// but the scanner didn't flag it because it only scanned svc-data).
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run authz:check',
    fixturePath:
      'apps/svc-insights/src/app/__selftest_fixture__/insights-bypass.service.ts',
    fixtureContent: BYPASS_FIXTURE_BODY,
  });
  t.assert(
    result.exitCode !== 0,
    `bypass in svc-insights fails scanner (got exit ${result.exitCode})`,
  );
}

// -----------------------------------------------------------------------
// Test 3 — Planted bypass in svc-ava.
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run authz:check',
    fixturePath:
      'apps/svc-ava/src/app/__selftest_fixture__/ava-bypass.service.ts',
    fixtureContent: BYPASS_FIXTURE_BODY,
  });
  t.assert(
    result.exitCode !== 0,
    `bypass in svc-ava fails scanner (got exit ${result.exitCode})`,
  );
}

// -----------------------------------------------------------------------
// Test 4 — Planted bypass in svc-workflow.
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run authz:check',
    fixturePath:
      'apps/svc-workflow/src/app/__selftest_fixture__/workflow-bypass.service.ts',
    fixtureContent: BYPASS_FIXTURE_BODY,
  });
  t.assert(
    result.exitCode !== 0,
    `bypass in svc-workflow fails scanner (got exit ${result.exitCode})`,
  );
}

// -----------------------------------------------------------------------
// Test 5 — Planted SAFE pattern (RequestContext+DataSource WITH
// AuthorizationService) is accepted.
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run authz:check',
    fixturePath:
      'apps/svc-data/src/app/__selftest_fixture__/safe.service.ts',
    fixtureContent: SAFE_FIXTURE_BODY,
  });
  t.assert(
    result.exitCode === 0,
    `RequestContext+DataSource WITH AuthorizationService is OK (got exit ${result.exitCode})`,
  );
}

// -----------------------------------------------------------------------
// Test 6 — svc-control-plane is INTENTIONALLY not scanned (canon §18
// carves out the multi-tenant control plane).
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run authz:check',
    fixturePath:
      'apps/svc-control-plane/src/app/__selftest_fixture__/cp-bypass.service.ts',
    fixtureContent: BYPASS_FIXTURE_BODY,
  });
  t.assert(
    result.exitCode === 0,
    `svc-control-plane is excluded — bypass there does NOT fail scanner (got exit ${result.exitCode})`,
  );
}

t.report();
