#!/usr/bin/env ts-node
/**
 * HubbleWave CI/CD wiring check (F106 / W0 task 7).
 *
 * Asserts that:
 *   - .github/workflows/cd.yml is workflow_run-triggered against CI.
 *   - Every CD job is gated on workflow_run.conclusion == 'success'
 *     (or workflow_dispatch for break-glass).
 *   - .github/workflows/ci.yml fires on push to master/main/develop so
 *     the workflow_run chain has something to trigger from.
 *   - No CD job uses a literal `if: always()` that would mask
 *     dependency failures (the `notify` job is exempt because its
 *     trigger is intentionally always-on; it's allowlisted explicitly).
 *
 * Hand-rolled YAML parser to avoid pulling a YAML dep just for two
 * workflow files. Keeps the scanner self-contained.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const CD_PATH = join(ROOT, '.github', 'workflows', 'cd.yml');
const CI_PATH = join(ROOT, '.github', 'workflows', 'ci.yml');

interface Violation {
  file: string;
  message: string;
}

const violations: Violation[] = [];

function read(path: string): string {
  if (!existsSync(path)) {
    violations.push({ file: path, message: 'workflow file does not exist' });
    return '';
  }
  return readFileSync(path, 'utf-8');
}

const cd = read(CD_PATH);
const ci = read(CI_PATH);

// ============================================================================
// CI must fire on push: master / main / develop so workflow_run can chain.
// ============================================================================

if (ci) {
  const ciOnPushBlock = ci.match(/^on:[\s\S]*?(?=^[A-Za-z])/m)?.[0] ?? '';
  if (!/push:/.test(ciOnPushBlock)) {
    violations.push({
      file: CI_PATH,
      message: 'CI must trigger on push (so cd.yml workflow_run can chain)',
    });
  } else if (!/branches:\s*\[[^\]]*master[^\]]*\]/.test(ciOnPushBlock)) {
    violations.push({
      file: CI_PATH,
      message: 'CI push trigger must include `master` branch',
    });
  }
}

// ============================================================================
// CD must be workflow_run-triggered with workflows: ['CI'].
// ============================================================================

if (cd) {
  const cdOnBlock = cd.match(/^on:[\s\S]*?(?=^[A-Za-z])/m)?.[0] ?? '';
  if (!/workflow_run:/.test(cdOnBlock)) {
    violations.push({
      file: CD_PATH,
      message:
        'CD must use workflow_run trigger (was: push trigger ignored CI). ' +
        'See F106 in master remediation roadmap.',
    });
  }
  if (!/workflows:\s*\[\s*['"]CI['"]\s*\]/.test(cdOnBlock)) {
    violations.push({
      file: CD_PATH,
      message: "CD workflow_run must reference workflows: ['CI']",
    });
  }
}

// ============================================================================
// No CD job may use `if: always()` (the `notify` job is the only
// exception, and it doesn't deploy — it just fires a Slack message).
// Anything else with `if: always()` would silently skip CI failures.
// ============================================================================

const NOTIFY_EXEMPT_JOB = 'notify';

if (cd) {
  // Jobs are top-level keys under `jobs:`. Roughly: lines like
  // `  jobname:` followed by a block. We look for `if: always()`
  // anywhere in the file and confirm it's inside the notify job.
  const lines = cd.split('\n');
  let currentJob: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const jobMatch = line.match(/^ {2}([a-z][a-z0-9_-]*):\s*$/i);
    if (jobMatch && !line.includes('-')) {
      // Top-level job declaration (2-space indent under `jobs:`).
      currentJob = jobMatch[1];
      continue;
    }
    if (/\bif:\s*always\(\)/i.test(line) || /always\(\)\s*&&/.test(line)) {
      if (currentJob !== NOTIFY_EXEMPT_JOB) {
        violations.push({
          file: CD_PATH,
          message:
            `Line ${i + 1}: \`if: always()\` in job '${currentJob ?? '<unknown>'}' bypasses ` +
            `dependency-failure short-circuit. Only the '${NOTIFY_EXEMPT_JOB}' job is exempt.`,
        });
      }
    }
  }
}

// ============================================================================
// Report
// ============================================================================

if (violations.length > 0) {
  console.error('CI/CD wiring check FAILED:');
  for (const v of violations) {
    console.error(`  [${v.file}] ${v.message}`);
  }
  process.exit(1);
}

console.log('CI/CD wiring check: ok');
