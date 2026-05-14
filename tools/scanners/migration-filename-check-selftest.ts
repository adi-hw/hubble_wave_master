import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function runFixture(filenames: string[]): { code: number; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'migfn-'));
  for (const fn of filenames) writeFileSync(join(dir, fn), '');
  try {
    const stdout = execSync(`npx tsx tools/scanners/migration-filename-check.ts --root=${dir}`, { encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (e: any) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runFixtureWithAllowlist(filenames: string[], allowlistEntries: { target: string; rationale: string; addedBy: string; addedAt: string; followUp?: string }[]): { code: number; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'migfn-al-'));
  for (const fn of filenames) writeFileSync(join(dir, fn), '');
  const allowlistPath = join(dir, 'allowlist.json');
  writeFileSync(allowlistPath, JSON.stringify({ entries: allowlistEntries }));
  try {
    const stdout = execSync(`npx tsx tools/scanners/migration-filename-check.ts --root=${dir} --allowlist=${allowlistPath}`, { encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (e: any) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Fail: forbidden token
const r1 = runFixture(['1700000000000-temp-fix.ts']);
console.assert(r1.code !== 0, 'forbidden token "temp" should fail');

const r2 = runFixture(['1700000000000-add-users-retry.ts']);
console.assert(r2.code !== 0, 'forbidden token "retry" should fail');

// Fail: wrong format
const r3 = runFixture(['add-something.ts']);
console.assert(r3.code !== 0, 'non-timestamped name should fail');

// Pass: standard format, no forbidden token
const r4 = runFixture(['1700000000000-add-users-table.ts']);
console.assert(r4.code === 0, 'standard filename should pass');

// Pass: forbidden token, but allowlisted by basename
const r5 = runFixtureWithAllowlist(
  ['1700000000000-fix-something.ts'],
  [{ target: '1700000000000-fix-something.ts', rationale: 'test', addedBy: 't', addedAt: '2026-05-14' }]
);
console.assert(r5.code === 0, 'allowlisted violation should pass');

console.log('migration-filename-check selftest: 5/5 assertions');
