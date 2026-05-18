import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'fs';
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

/**
 * Drop a fixture entity at a path that mirrors `libs/control-plane-db/`
 * so the scanner's path-based plane detection routes it to the
 * `controlPlane` section of the manifest. Used by the round-3
 * per-plane-manifest assertions to prove a control-plane drift is
 * caught rather than silently skipped.
 */
function runWithControlPlaneFixture(entityContent: string, manifestContent: string): { code: number; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'entity-scanner-cp-test-'));
  const nested = join(dir, 'libs', 'control-plane-db', 'src', 'lib', 'entities');
  mkdirSync(nested, { recursive: true });
  writeFileSync(join(nested, 'test.entity.ts'), entityContent);
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

// =====================================================================
// Per-plane manifest assertions (W2 follow-up round 3).
//
// The scanner now reads a per-plane manifest. The previous skip-the-
// control-plane behavior closed a false-positive but hid drift — a
// control-plane entity declaring `schema: 'identity'` would no longer
// be caught. The assertions below prove drift IS caught now AND that
// the legacy flat-manifest shape still loads (back-compat).
// =====================================================================

const perPlaneManifest = JSON.stringify({
  _version: 2,
  instance: {
    identity: ['refresh_tokens'],
  },
  controlPlane: {
    public: ['refresh_tokens'],
  },
});

// Control-plane entity declaring no schema (correct — public is the
// default) MUST pass when the manifest's controlPlane.public lists it.
const cpCorrect = `@Entity('refresh_tokens') export class RefreshToken {}`;
const r6 = runWithControlPlaneFixture(cpCorrect, perPlaneManifest);
console.assert(r6.code === 0, 'Per-plane: control-plane refresh_tokens with no schema declaration passes');

// Control-plane entity declaring `schema: 'identity'` MUST fail. The
// pre-round-3 scanner skipped control-plane entirely; this assertion
// proves the per-plane manifest catches the drift the skip hid.
const cpDrift = `@Entity({ name: 'refresh_tokens', schema: 'identity' }) export class RefreshToken {}`;
const r7 = runWithControlPlaneFixture(cpDrift, perPlaneManifest);
console.assert(r7.code !== 0, 'Per-plane: control-plane entity declaring instance schema is caught');

// Instance-plane entity for `refresh_tokens` MUST validate against
// instance.identity, not controlPlane.public. A bare
// `@Entity('refresh_tokens')` at the instance plane is wrong
// (missing schema='identity').
const instanceDrift = `@Entity('refresh_tokens') export class RefreshToken {}`;
const r8 = runWithFixture(instanceDrift, perPlaneManifest);
console.assert(r8.code !== 0, 'Per-plane: instance refresh_tokens without schema is caught (does not match controlPlane.public by mistake)');

// Legacy flat-manifest backward compatibility — a manifest without
// `instance`/`controlPlane` keys must still load and apply to the
// instance plane.
const legacyOk = `@Entity({ name: 'users', schema: 'identity' }) export class User {}`;
const r9 = runWithFixture(legacyOk, manifest);
console.assert(r9.code === 0, 'Legacy flat manifest still loads + passes');

console.log('entity-schema-ownership-check selftest: 9/9 assertions');
