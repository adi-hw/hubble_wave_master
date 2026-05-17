import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function setupFixtureDir(allowlistEntries: Array<{ target: string; rationale: string; addedBy: string; addedAt: string }> = []) {
  const dir = mkdtempSync(join(tmpdir(), 'nohs256-'));
  mkdirSync(join(dir, 'apps/api/src/app'), { recursive: true });
  mkdirSync(join(dir, 'libs/foo/src/lib'), { recursive: true });
  mkdirSync(join(dir, 'tools/scanners'), { recursive: true });
  writeFileSync(
    join(dir, 'tools/scanners/no-hs256-allowlist.json'),
    JSON.stringify({ $schema: './allowlist-schema.json', entries: allowlistEntries }),
  );
  return dir;
}

function runScanner(dir: string): { code: number; stdout: string } {
  try {
    const stdout = execSync(
      `npx tsx tools/scanners/no-hs256-signing-check.ts --root=${dir} --ci`,
      { encoding: 'utf8' },
    );
    return { code: 0, stdout };
  } catch (e) {
    const err = e as { status?: number; stdout?: Buffer | string };
    return {
      code: err.status ?? 1,
      stdout: err.stdout?.toString() ?? '',
    };
  }
}

let assertions = 0;
function assertTrue(condition: boolean, message: string) {
  assertions += 1;
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Fixture 1: clean codebase (no HS256 patterns) → ok
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir();
  writeFileSync(
    join(dir, 'apps/api/src/app/x.service.ts'),
    `import { SignJWT } from 'jose';\nexport async function sign() { return new SignJWT({}).sign(undefined as never); }\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 0, 'clean fixture: scanner exits 0');
  assertTrue(r.stdout.includes('"total":0'), 'clean fixture: 0 violations');
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixture 2: `from 'jsonwebtoken'` is flagged
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir();
  writeFileSync(
    join(dir, 'apps/api/src/app/x.service.ts'),
    `import jwt from 'jsonwebtoken';\nexport const j = jwt;\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 1, "jsonwebtoken import: scanner exits 1");
  assertTrue(r.stdout.includes('jsonwebtoken-import'), 'jsonwebtoken import: pattern id reported');
}

// ---------------------------------------------------------------------------
// Fixture 3: `algorithm: 'HS256'` is flagged
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir();
  writeFileSync(
    join(dir, 'apps/api/src/app/x.service.ts'),
    `export const opts = { algorithm: 'HS256' as const };\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 1, 'HS256 algorithm: scanner exits 1');
  assertTrue(r.stdout.includes('algorithm-hs256'), 'HS256 algorithm: pattern id reported');
}

// ---------------------------------------------------------------------------
// Fixture 4: `algorithms: ['HS256']` is flagged
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir();
  writeFileSync(
    join(dir, 'apps/api/src/app/x.service.ts'),
    `export const opts = { algorithms: ['HS256'] as const };\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 1, "algorithms: ['HS256']: scanner exits 1");
  assertTrue(r.stdout.includes('algorithm-hs256'), "algorithms: ['HS256']: pattern id reported");
}

// ---------------------------------------------------------------------------
// Fixture 5: `JwtModule.register(` is flagged
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir();
  writeFileSync(
    join(dir, 'apps/api/src/app/x.module.ts'),
    `import { JwtModule } from '@nestjs/jwt';\n@Module({ imports: [JwtModule.register({})] })\nexport class X {}\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 1, 'JwtModule.register: scanner exits 1');
  assertTrue(r.stdout.includes('jwt-module-register'), 'JwtModule.register: pattern id reported');
}

// ---------------------------------------------------------------------------
// Fixture 6: `secretOrKey:` is flagged
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir();
  writeFileSync(
    join(dir, 'apps/api/src/app/x.strategy.ts'),
    `export const cfg = { secretOrKey: 'something' };\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 1, 'secretOrKey: scanner exits 1');
  assertTrue(
    r.stdout.includes('passport-jwt-secret-or-key'),
    'secretOrKey: pattern id reported',
  );
}

// ---------------------------------------------------------------------------
// Fixture 7: matches inside line comments are IGNORED (docs, not code)
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir();
  writeFileSync(
    join(dir, 'apps/api/src/app/x.service.ts'),
    `// import from 'jsonwebtoken' — historical note only\n// algorithm: 'HS256' was the pre-Stream-1 path\nexport const ok = true;\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 0, 'comments-only HS256 refs: scanner exits 0');
  assertTrue(r.stdout.includes('"total":0'), 'comments-only HS256 refs: 0 violations');
}

// ---------------------------------------------------------------------------
// Fixture 8: allowlist suppresses a flagged file
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir([
    {
      target: 'apps/api/src/app/x.service.ts',
      rationale: 'self-test fixture for allowlist suppression',
      addedBy: 'selftest',
      addedAt: '2026-05-17',
    },
  ]);
  writeFileSync(
    join(dir, 'apps/api/src/app/x.service.ts'),
    `import jwt from 'jsonwebtoken';\nexport const j = jwt;\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 0, 'allowlisted file: scanner exits 0');
  assertTrue(r.stdout.includes('"total":0'), 'allowlisted file: 0 violations');
}

// ---------------------------------------------------------------------------
// Fixture 9: scope covers libs/ (not just apps/)
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir();
  writeFileSync(
    join(dir, 'libs/foo/src/lib/x.service.ts'),
    `import jwt from 'jsonwebtoken';\nexport const j = jwt;\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 1, 'libs/ violation: scanner exits 1');
  assertTrue(r.stdout.includes('jsonwebtoken-import'), 'libs/ violation: pattern id reported');
}

console.log(`no-hs256-signing selftest: ${assertions}/${assertions} assertions`);
