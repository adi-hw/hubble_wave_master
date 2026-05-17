import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function setupFixtureDir(
  registryCodes: string[],
  allowlistEntries: Array<{ target: string; rationale: string; addedBy: string; addedAt: string }> = [],
) {
  const dir = mkdtempSync(join(tmpdir(), 'permreg-'));
  mkdirSync(join(dir, 'libs/permission-registry/src/lib'), { recursive: true });
  mkdirSync(join(dir, 'apps/api/src/app'), { recursive: true });
  mkdirSync(join(dir, 'apps/web-client/src'), { recursive: true });
  mkdirSync(join(dir, 'tools/scanners'), { recursive: true });

  const entries = registryCodes
    .map(
      (c) =>
        `  { code: '${c}', plane: 'instance', domain: 'x', action: 'read', dangerous: false, description: '${c}' },`,
    )
    .join('\n');
  writeFileSync(
    join(dir, 'libs/permission-registry/src/lib/registry.ts'),
    `export const PERMISSION_REGISTRY = [\n${entries}\n];\n`,
  );

  writeFileSync(
    join(dir, 'tools/scanners/permission-registry-sync-allowlist.json'),
    JSON.stringify({ $schema: './allowlist-schema.json', entries: allowlistEntries }),
  );

  return dir;
}

function runScanner(dir: string, flags = ''): { code: number; stdout: string } {
  try {
    const stdout = execSync(
      `npx tsx tools/scanners/permission-registry-sync-check.ts --root=${dir} --ci ${flags}`,
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
// Fixture 1: registry + call sites perfectly in sync → 0 violations
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(['audit:read', 'system:admin']);
  writeFileSync(
    join(dir, 'apps/api/src/app/x.controller.ts'),
    `@Controller('x')\nexport class XController {\n  @RequirePermission('audit:read')\n  @Get()\n  read() {}\n\n  @RequirePermission('system:admin')\n  @Post()\n  cmd() {}\n}\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 0, 'in-sync fixture: scanner exits 0');
  const parsed = JSON.parse(r.stdout);
  assertTrue(parsed.total === 0, 'in-sync: total=0');
  assertTrue(parsed.unregistered.length === 0, 'in-sync: no unregistered');
  assertTrue(parsed.orphans.length === 0, 'in-sync: no orphans');
}

// ---------------------------------------------------------------------------
// Fixture 2: call site uses a code NOT in registry → unregistered
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(['audit:read']);
  writeFileSync(
    join(dir, 'apps/api/src/app/x.controller.ts'),
    `@Controller('x')\nexport class XController {\n  @RequirePermission('nope:write')\n  @Post()\n  cmd() {}\n}\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 0, 'unregistered in reporting-only: exits 0');
  const parsed = JSON.parse(r.stdout);
  assertTrue(parsed.unregistered.length === 1, 'unregistered: 1 site');
  assertTrue(parsed.unregistered[0].code === 'nope:write', 'unregistered: code captured');
}

// ---------------------------------------------------------------------------
// Fixture 3: registry has code with zero references → orphan
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(['audit:read', 'orphan:code']);
  writeFileSync(
    join(dir, 'apps/api/src/app/x.controller.ts'),
    `@Controller('x')\nexport class XController {\n  @RequirePermission('audit:read')\n  @Get()\n  read() {}\n}\n`,
  );
  const r = runScanner(dir);
  const parsed = JSON.parse(r.stdout);
  assertTrue(parsed.orphans.length === 1, 'orphan: 1 entry');
  assertTrue(parsed.orphans[0] === 'orphan:code', 'orphan: code captured');
  assertTrue(parsed.unregistered.length === 0, 'orphan: no unregistered');
}

// ---------------------------------------------------------------------------
// Fixture 4: @RequireServiceScope is also captured
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(['svc:scope']);
  writeFileSync(
    join(dir, 'apps/api/src/app/x.controller.ts'),
    `@Controller('x')\nexport class XController {\n  @AllowServiceToken()\n  @RequireServiceScope('svc:scope')\n  @Post()\n  ingest() {}\n}\n`,
  );
  const r = runScanner(dir);
  const parsed = JSON.parse(r.stdout);
  assertTrue(parsed.total === 0, '@RequireServiceScope: detected as reference');
}

// ---------------------------------------------------------------------------
// Fixture 5: JSX <RequirePermission permission="..." /> is captured (web-client)
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(['ui:feature']);
  writeFileSync(
    join(dir, 'apps/web-client/src/x.tsx'),
    `export function X() {\n  return <RequirePermission permission="ui:feature"><Button /></RequirePermission>;\n}\n`,
  );
  const r = runScanner(dir);
  const parsed = JSON.parse(r.stdout);
  assertTrue(parsed.total === 0, 'JSX RequirePermission: detected as reference');
  assertTrue(parsed.callSiteCount === 1, 'JSX RequirePermission: counted');
}

// ---------------------------------------------------------------------------
// Fixture 6: --strict mode → exits 1 on any mismatch
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(['audit:read']);
  writeFileSync(
    join(dir, 'apps/api/src/app/x.controller.ts'),
    `@Controller('x')\nexport class XController {\n  @RequirePermission('nope:write')\n  @Post()\n  cmd() {}\n}\n`,
  );
  const r = runScanner(dir, '--strict');
  assertTrue(r.code === 1, 'strict + unregistered: exits 1');
}

// ---------------------------------------------------------------------------
// Fixture 7: allowlist suppresses both directions for a code
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(['audit:read', 'planned:code'], [
    {
      target: 'planned:code',
      rationale: 'self-test allowlist',
      addedBy: 'selftest',
      addedAt: '2026-05-17',
    },
  ]);
  // No call site references `planned:code` — would normally be orphan,
  // but the allowlist exempts it.
  writeFileSync(
    join(dir, 'apps/api/src/app/x.controller.ts'),
    `@Controller('x')\nexport class XController {\n  @RequirePermission('audit:read')\n  @Get()\n  read() {}\n}\n`,
  );
  const r = runScanner(dir);
  const parsed = JSON.parse(r.stdout);
  assertTrue(parsed.orphans.length === 0, 'allowlisted code is not an orphan');
  assertTrue(parsed.unregistered.length === 0, 'allowlisted code: no unregistered');
}

// ---------------------------------------------------------------------------
// Fixture 8: comment-line references are NOT counted
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir(['audit:read']);
  writeFileSync(
    join(dir, 'apps/api/src/app/x.controller.ts'),
    `// Historical note: previously @RequirePermission('old:code') was used.\n@Controller('x')\nexport class XController {\n  @RequirePermission('audit:read')\n  @Get()\n  read() {}\n}\n`,
  );
  const r = runScanner(dir);
  const parsed = JSON.parse(r.stdout);
  assertTrue(parsed.total === 0, 'comment-line @RequirePermission: not counted');
  assertTrue(parsed.callSiteCount === 1, 'comment-line: only the real call site counted');
}

console.log(`permission-registry-sync selftest: ${assertions}/${assertions} assertions`);
