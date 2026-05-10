#!/usr/bin/env ts-node
/**
 * Self-test for tools/service-boundary-check.ts (W0 task 5 / F056).
 *
 * Asserts:
 *   1. Scanner exits 0 against current master.
 *   2. Cross-service IMPORT (apps/api/data — logical service svc-data —
 *      importing AutomationRule from @hubblewave/instance-db) fails —
 *      the entity-ownership rule.
 *   3. String-table-name `getRepository('automation_rules')` from a
 *      non-owner area fails — the write-bypass rule.
 *   4. Raw SQL `UPDATE automation_rules SET ...` from a non-owner
 *      area fails — the write-bypass rule.
 *   5. Raw SQL `INSERT INTO scheduled_jobs ...` from a non-owner area
 *      fails (generalizes the rule across the ENTITY_OWNERSHIP map).
 *   6. Owner area (apps/api/automation — logical service svc-automation)
 *      can do all of the above on the tables it owns.
 *   7. Word-boundary defense: 'automation_rules_extra' does NOT
 *      false-positive against 'automation_rules'.
 *
 * Per scanner-self-test contract: framework helpers are duplicated.
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

const t = createSelfTest('service-boundary-check');

// -----------------------------------------------------------------------
// Test 1 — Master tree clean.
// -----------------------------------------------------------------------
{
  let exitCode = 0;
  let stdout = '';
  try {
    stdout = execSync('npm run service-boundary:check', {
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
    /entity ownership rule\(s\) enforced/.test(stdout),
    'scanner reports entity ownership rules in success output',
  );
  t.assert(
    /entity write-bypass rule\(s\) enforced/.test(stdout),
    'scanner reports write-bypass rules in success output',
  );
}

// -----------------------------------------------------------------------
// Test 2 — Cross-service IMPORT of AutomationRule from apps/api/data
// (logical service svc-data) fails.
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run service-boundary:check',
    fixturePath:
      'apps/api/src/app/data/__selftest_fixture__/import-bypass.service.ts',
    fixtureContent: `
import { Injectable } from '@nestjs/common';
import { AutomationRule } from '@hubblewave/instance-db';
import { Repository } from 'typeorm';
@Injectable()
export class BadImportService {
  constructor(private repo: Repository<AutomationRule>) {}
}
`,
  });
  t.assert(
    result.exitCode !== 0,
    `cross-service AutomationRule import in apps/api/data fails scanner (got exit ${result.exitCode})`,
  );
  t.assert(
    /entity ownership/.test(result.stdout + result.stderr),
    'output cites entity ownership rule',
  );
}

// -----------------------------------------------------------------------
// Test 3 — String-table-name getRepository('automation_rules') in
// apps/api/data (logical service svc-data) fails (W0 task 5 new check).
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run service-boundary:check',
    fixturePath:
      'apps/api/src/app/data/__selftest_fixture__/string-getrepo.service.ts',
    fixtureContent: `
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Injectable()
export class StringGetRepoService {
  constructor(private ds: DataSource) {}
  async write(payload: any) {
    return this.ds.getRepository('automation_rules').save(payload);
  }
}
`,
  });
  t.assert(
    result.exitCode !== 0,
    `string-table-name getRepository('automation_rules') in apps/api/data fails (got exit ${result.exitCode})`,
  );
  t.assert(
    /string-getRepository/.test(result.stdout + result.stderr),
    'output cites string-getRepository pattern',
  );
}

// -----------------------------------------------------------------------
// Test 4 — Raw SQL UPDATE on automation_rules in apps/api/data fails.
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run service-boundary:check',
    fixturePath:
      'apps/api/src/app/data/__selftest_fixture__/raw-sql-update.service.ts',
    fixtureContent: `
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Injectable()
export class RawSqlService {
  constructor(private ds: DataSource) {}
  async sneaky() {
    return this.ds.query("UPDATE automation_rules SET enabled = false WHERE id = $1", [1]);
  }
}
`,
  });
  t.assert(
    result.exitCode !== 0,
    `raw SQL UPDATE on automation_rules in apps/api/data fails (got exit ${result.exitCode})`,
  );
  t.assert(
    /raw-sql-update/.test(result.stdout + result.stderr),
    'output cites raw-sql-update pattern',
  );
}

// -----------------------------------------------------------------------
// Test 5 — Raw SQL INSERT on scheduled_jobs from a non-owner area
// (apps/api/data, logical service svc-data) fails. Different table than
// Test 4 to verify the rule generalizes across the ENTITY_OWNERSHIP map.
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run service-boundary:check',
    fixturePath:
      'apps/api/src/app/data/__selftest_fixture__/raw-sql-insert.service.ts',
    fixtureContent: `
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Injectable()
export class DataSneakService {
  constructor(private ds: DataSource) {}
  async sneaky() {
    return this.ds.query("INSERT INTO scheduled_jobs (id, name) VALUES ($1, $2)", [1, 'x']);
  }
}
`,
  });
  t.assert(
    result.exitCode !== 0,
    `raw SQL INSERT on scheduled_jobs from non-owner area fails (got exit ${result.exitCode})`,
  );
}

// -----------------------------------------------------------------------
// Test 6 — Owner service area (apps/api/automation, logical service
// svc-automation) can write to its own tables. Per canon §8 INVERT
// workflow is merged into automation, so this area owns automation_rules,
// scheduled_jobs, and automation_execution_logs collectively.
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run service-boundary:check',
    fixturePath:
      'apps/api/src/app/automation/__selftest_fixture__/owner-write.service.ts',
    fixtureContent: `
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Injectable()
export class OwnerOk {
  constructor(private ds: DataSource) {}
  async ok() {
    await this.ds.getRepository('automation_rules').save({});
    await this.ds.query('UPDATE automation_rules SET enabled = true');
    await this.ds.query('INSERT INTO scheduled_jobs (id) VALUES (1)');
    await this.ds.query('DELETE FROM automation_execution_logs WHERE id = 1');
  }
}
`,
  });
  t.assert(
    result.exitCode === 0,
    `owner service area (apps/api/automation) can write to its own tables (got exit ${result.exitCode})`,
  );
}

// -----------------------------------------------------------------------
// Test 7 — Word boundary: 'automation_rules_extra' must NOT match
// 'automation_rules'. Defensive against false positives.
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run service-boundary:check',
    fixturePath:
      'apps/api/src/app/data/__selftest_fixture__/word-boundary.service.ts',
    fixtureContent: `
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Injectable()
export class WordBoundaryService {
  constructor(private ds: DataSource) {}
  async wbnd() {
    // 'automation_rules_extra' is a hypothetical non-owned table.
    return this.ds.query('UPDATE automation_rules_extra SET x = 1');
  }
}
`,
  });
  t.assert(
    result.exitCode === 0,
    `'automation_rules_extra' does NOT false-positive against 'automation_rules' (got exit ${result.exitCode})`,
  );
}

t.report();
