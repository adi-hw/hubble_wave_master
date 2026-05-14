import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function runFixture(setup: (dir: string) => void): { code: number; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'cd-scanner-'));
  setup(dir);
  try {
    const stdout = execSync(`npx tsx tools/scanners/cross-domain-import-check.ts --root=${dir} --manifest=${join(dir, 'manifest.json')} --allowlist=${join(dir, 'allowlist.json')}`, { encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (e: any) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const manifest = JSON.stringify({ identity: ['users'], metadata: ['collections'] });
const emptyAllowlist = JSON.stringify({ entries: [] });

// Fail: identity entity imports metadata entity (no allowlist entry)
const r1 = runFixture((d) => {
  writeFileSync(join(d, 'manifest.json'), manifest);
  writeFileSync(join(d, 'allowlist.json'), emptyAllowlist);
  mkdirSync(join(d, 'identity'));
  mkdirSync(join(d, 'metadata'));
  writeFileSync(join(d, 'identity/user.entity.ts'),
    `import { Collection } from '../metadata/collection.entity';\n@Entity({ name: 'users', schema: 'identity' }) export class User {}`);
  writeFileSync(join(d, 'metadata/collection.entity.ts'),
    `@Entity({ name: 'collections', schema: 'metadata' }) export class Collection {}`);
});
console.assert(r1.code !== 0, 'Should fail when entity imports across domains without allowlist');

// Pass: same-domain import (no cross-domain edges)
const r2 = runFixture((d) => {
  writeFileSync(join(d, 'manifest.json'), manifest);
  writeFileSync(join(d, 'allowlist.json'), emptyAllowlist);
  mkdirSync(join(d, 'identity'));
  writeFileSync(join(d, 'identity/user.entity.ts'),
    `@Entity({ name: 'users', schema: 'identity' }) export class User {}`);
});
console.assert(r2.code === 0, 'Should pass when no cross-domain imports');

// Pass: cross-domain import IS in allowlist
const populatedAllowlist = JSON.stringify({
  entries: [
    { from: 'identity.user', to: 'metadata.collection', rationale: 'test', addedBy: 'tester', addedAt: '2026-05-14' }
  ]
});
const r3 = runFixture((d) => {
  writeFileSync(join(d, 'manifest.json'), manifest);
  writeFileSync(join(d, 'allowlist.json'), populatedAllowlist);
  mkdirSync(join(d, 'identity'));
  mkdirSync(join(d, 'metadata'));
  writeFileSync(join(d, 'identity/user.entity.ts'),
    `import { Collection } from '../metadata/collection.entity';\n@Entity({ name: 'users', schema: 'identity' }) export class User {}`);
  writeFileSync(join(d, 'metadata/collection.entity.ts'),
    `@Entity({ name: 'collections', schema: 'metadata' }) export class Collection {}`);
});
console.assert(r3.code === 0, 'Should pass when cross-domain import is allowlisted');

console.log('cross-domain-import-check selftest: 3/3 assertions');
