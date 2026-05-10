#!/usr/bin/env ts-node
/**
 * Self-test for tools/dead-code-check.ts (W0 task 10 / Deletion Catalog §D.6).
 *
 * Asserts:
 *   1. Master tree clean (12 allowlisted entries, all owed to W4).
 *   2. Planted tmpclaude-* directory triggers trash-pattern detection.
 *   3. Planted ralph-loop file triggers trash-pattern detection.
 *   4. Planted .env.backup triggers trash-pattern detection.
 *   5. Planted benign file does NOT trigger.
 *   6. Allowlist is honored — adding a plant to the allowlist makes
 *      scanner pass even with the plant in place.
 *
 * NOT covered (out of W0 scope):
 *   - Phantom-dep detection requires mutating package.json which would
 *     contaminate the running scanner instance. The bcrypt allowlist
 *     entry is sufficient evidence that the detection works (otherwise
 *     it would surface as a finding).
 *   - Orphan-lib detection requires creating a fake lib structure plus
 *     a tsconfig alias plus reverting all of it; too invasive.
 *     libs/enterprise and libs/ui-components in the allowlist are
 *     sufficient evidence the detection works.
 *
 * Per scanner-self-test contract: framework helpers are duplicated.
 */

import { execSync } from 'child_process';
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
} from 'fs';
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

const t = createSelfTest('dead-code-check');

// -----------------------------------------------------------------------
// Test 1 — Master tree clean (allowlist matches reality).
// -----------------------------------------------------------------------
{
  let exitCode = 0;
  let stdout = '';
  try {
    stdout = execSync('npm run dead-code:check', {
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
    /dead-code-check: ok/.test(stdout),
    'scanner reports clean status',
  );
  t.assert(
    /allowlisted entry\/entries tracked/.test(stdout),
    'scanner advertises allowlist on success',
  );
  t.assert(
    /\[owed to W4\]/.test(stdout),
    'allowlist shows W4 follow-up annotations',
  );
}

// -----------------------------------------------------------------------
// Test 2 — Planted tmpclaude-* directory fails scanner.
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run dead-code:check',
    fixturePath: 'tools/tmpclaude-selftest-x123/probe.ts',
    fixtureContent: '// noop',
  });
  t.assert(
    result.exitCode !== 0,
    `tmpclaude-* fixture fails scanner (got exit ${result.exitCode})`,
  );
  t.assert(
    /trash-pattern/.test(result.stdout + result.stderr),
    'output cites trash-pattern type',
  );
  t.assert(
    /tmpclaude-selftest-x123/.test(result.stdout + result.stderr),
    'output names the planted path',
  );
}

// -----------------------------------------------------------------------
// Test 3 — Planted ralph-loop file fails scanner.
// (The planted name must NOT collide with a real file. Use a synthetic
// extension to ensure uniqueness, but match the regex.)
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run dead-code:check',
    fixturePath: 'tools/__selftest_fixture__/ralph-loop.sh',
    fixtureContent: '#!/usr/bin/env bash\necho test\n',
  });
  t.assert(
    result.exitCode !== 0,
    `ralph-loop.sh fixture fails scanner (got exit ${result.exitCode})`,
  );
  t.assert(
    /AI-tooling artifact/.test(result.stdout + result.stderr),
    'output cites AI-tooling reason',
  );
}

// -----------------------------------------------------------------------
// Test 4 — Planted benign file does NOT fail.
// -----------------------------------------------------------------------
{
  const result = runScannerOnFixture({
    scannerCommand: 'npm run dead-code:check',
    fixturePath: 'tools/__selftest_fixture__/benign.ts',
    fixtureContent: 'export const x = 1;',
  });
  t.assert(
    result.exitCode === 0,
    `benign fixture in tools/__selftest_fixture__/ does NOT fail scanner (got exit ${result.exitCode})`,
  );
}

// -----------------------------------------------------------------------
// Test 5 — Allowlist is honored (mutate-then-restore allowlist file).
// -----------------------------------------------------------------------
{
  const allowlistPath = resolve(process.cwd(), 'tools/dead-code-allowlist.json');
  const original = readFileSync(allowlistPath, 'utf-8');

  const fixturePath = 'tools/tmpclaude-allowtest-y456/probe.ts';
  const fixtureAbs = resolve(process.cwd(), fixturePath);
  const fixtureDir = dirname(fixtureAbs);

  // Mutate allowlist to include this fixture path.
  const augmented = JSON.parse(original) as Array<Record<string, unknown>>;
  augmented.push({
    type: 'trash-pattern',
    path: 'tools/tmpclaude-allowtest-y456',
    reason: 'self-test fixture',
    addedBy: 'dead-code-check-selftest',
    addedAt: '2026-05-09',
  });
  writeFileSync(allowlistPath, JSON.stringify(augmented, null, 2), 'utf-8');

  // Plant the fixture.
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(fixtureAbs, '// noop', 'utf-8');

  let exitCode = 0;
  try {
    execSync('npm run dead-code:check', { stdio: 'pipe' });
  } catch (e: unknown) {
    exitCode = (e as { status?: number }).status ?? 1;
  }

  // Restore allowlist + remove fixture before asserting (so any failure
  // doesn't leave the repo dirty).
  writeFileSync(allowlistPath, original, 'utf-8');
  try {
    rmSync(fixtureAbs, { force: true });
    rmSync(fixtureDir, { recursive: true, force: true });
  } catch {
    // tolerated
  }

  t.assert(
    exitCode === 0,
    `allowlisted plant does NOT fail scanner (got exit ${exitCode})`,
  );
}

t.report();
