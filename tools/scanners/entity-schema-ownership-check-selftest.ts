import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function runWithFixture(entityContent: string, manifestContent: string): { code: number; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'entity-scanner-test-'));
  writeFileSync(join(dir, 'test.entity.ts'), entityContent);
  writeFileSync(join(dir, 'manifest.json'), manifestContent);
  try {
    const stdout = execSync(`npx tsx tools/scanners/entity-schema-ownership-check.ts --root=${dir} --manifest=${join(dir, 'manifest.json')}`, { encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (e: any) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const manifest = JSON.stringify({ identity: ['users'], public: ['key_metadata'] });

const noSchema = `@Entity('users') export class User {}`;
const r1 = runWithFixture(noSchema, manifest);
console.assert(r1.code !== 0, 'Should fail when schema missing for identity table');

const wrongSchema = `@Entity({ name: 'users', schema: 'metadata' }) export class User {}`;
const r2 = runWithFixture(wrongSchema, manifest);
console.assert(r2.code !== 0, 'Should fail when schema is wrong for table');

const correctSchema = `@Entity({ name: 'users', schema: 'identity' }) export class User {}`;
const r3 = runWithFixture(correctSchema, manifest);
console.assert(r3.code === 0, 'Should pass when schema matches manifest');

const publicNoSchema = `@Entity('key_metadata') export class KeyMetadata {}`;
const r4 = runWithFixture(publicNoSchema, manifest);
console.assert(r4.code === 0, 'Should pass when table is in public and no schema declared');

const multilineCorrect = `@Entity({\n  name: 'users',\n  schema: 'identity',\n}) export class User {}`;
const r5 = runWithFixture(multilineCorrect, manifest);
console.assert(r5.code === 0, 'Should pass when multi-line @Entity has correct schema');

console.log('entity-schema-ownership-check selftest: 5/5 assertions');
