import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function setupFixtureDir(allowlistEntries: Array<{ target: string; rationale: string; addedBy: string; addedAt: string }> = []) {
  const dir = mkdtempSync(join(tmpdir(), 'nutq-'));
  mkdirSync(join(dir, 'apps/api/src/app'), { recursive: true });
  mkdirSync(join(dir, 'tools/scanners'), { recursive: true });
  writeFileSync(
    join(dir, 'tools/scanners/no-untyped-req-allowlist.json'),
    JSON.stringify({ $schema: './allowlist-schema.json', entries: allowlistEntries }),
  );
  return dir;
}

function runScanner(dir: string): { code: number; stdout: string } {
  try {
    const stdout = execSync(
      `npx tsx tools/scanners/no-untyped-req-check.ts --root=${dir} --ci`,
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
// Fixture 1: clean controller using a typed shape → ok
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir();
  writeFileSync(
    join(dir, 'apps/api/src/app/x.controller.ts'),
    `import { Controller, Get, Req } from '@nestjs/common';\nimport { InstanceRequest } from '@hubblewave/auth-guard';\n\n@Controller('x')\nexport class XController {\n  @Get()\n  list(@Req() req: InstanceRequest) { return req.context; }\n}\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 0, 'typed InstanceRequest: scanner exits 0');
  assertTrue(r.stdout.includes('"total":0'), 'typed InstanceRequest: 0 violations');
}

// ---------------------------------------------------------------------------
// Fixture 2: `@Req() req: any` → flagged
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir();
  writeFileSync(
    join(dir, 'apps/api/src/app/x.controller.ts'),
    `import { Controller, Get, Req } from '@nestjs/common';\n\n@Controller('x')\nexport class XController {\n  @Get()\n  list(@Req() req: any) { return req.user; }\n}\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 1, '@Req() req: any: scanner exits 1');
  assertTrue(r.stdout.includes('"type":"any"'), '@Req() req: any: type=any reported');
}

// ---------------------------------------------------------------------------
// Fixture 3: `@Req() req: Request` → flagged
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir();
  writeFileSync(
    join(dir, 'apps/api/src/app/x.controller.ts'),
    `import { Controller, Get, Req } from '@nestjs/common';\nimport { Request } from 'express';\n\n@Controller('x')\nexport class XController {\n  @Get()\n  list(@Req() req: Request) { return req.url; }\n}\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 1, '@Req() req: Request: scanner exits 1');
  assertTrue(r.stdout.includes('"type":"request"'), '@Req() req: Request: type=request reported');
}

// ---------------------------------------------------------------------------
// Fixture 4: `@Request()` (the alias decorator) is also covered
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir();
  writeFileSync(
    join(dir, 'apps/api/src/app/x.controller.ts'),
    `import { Controller, Get, Request } from '@nestjs/common';\n\n@Controller('x')\nexport class XController {\n  @Get()\n  list(@Request() req: any) { return req.user; }\n}\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 1, '@Request() req: any: scanner exits 1');
}

// ---------------------------------------------------------------------------
// Fixture 5: optional parameter `@Req() req?: any` → flagged
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir();
  writeFileSync(
    join(dir, 'apps/api/src/app/x.controller.ts'),
    `import { Controller, Get, Req } from '@nestjs/common';\n\n@Controller('x')\nexport class XController {\n  @Get()\n  list(@Req() req?: any) { return req?.user; }\n}\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 1, 'optional @Req() req?: any: scanner exits 1');
}

// ---------------------------------------------------------------------------
// Fixture 6: parameterized Request (`Request<...>`) is intentionally allowed
// (some apps augment Express's generic Request; allow until it becomes a real issue)
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir();
  writeFileSync(
    join(dir, 'apps/api/src/app/x.controller.ts'),
    `import { Controller, Get, Req } from '@nestjs/common';\nimport { Request } from 'express';\n\n@Controller('x')\nexport class XController {\n  @Get()\n  list(@Req() req: Request<{ id: string }>) { return req.params.id; }\n}\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 0, 'parameterized Request<>: scanner exits 0');
  assertTrue(r.stdout.includes('"total":0'), 'parameterized Request<>: 0 violations');
}

// ---------------------------------------------------------------------------
// Fixture 7: comments mentioning `req: any` are NOT flagged
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir();
  writeFileSync(
    join(dir, 'apps/api/src/app/x.controller.ts'),
    `import { Controller, Get, Req } from '@nestjs/common';\nimport { InstanceRequest } from '@hubblewave/auth-guard';\n\n// historical note: previously @Req() req: any was permitted\n@Controller('x')\nexport class XController {\n  @Get()\n  list(@Req() req: InstanceRequest) { return req.context; }\n}\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 0, 'comment mentioning req: any: scanner exits 0');
  assertTrue(r.stdout.includes('"total":0'), 'comment mentioning req: any: 0 violations');
}

// ---------------------------------------------------------------------------
// Fixture 8: allowlisted file is silently ok
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir([
    {
      target: 'apps/api/src/app/x.controller.ts',
      rationale: 'self-test allowlist',
      addedBy: 'selftest',
      addedAt: '2026-05-17',
    },
  ]);
  writeFileSync(
    join(dir, 'apps/api/src/app/x.controller.ts'),
    `import { Controller, Get, Req } from '@nestjs/common';\n\n@Controller('x')\nexport class XController {\n  @Get()\n  list(@Req() req: any) { return req.user; }\n}\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 0, 'allowlisted file: scanner exits 0');
  assertTrue(r.stdout.includes('"total":0'), 'allowlisted file: 0 violations');
}

// ---------------------------------------------------------------------------
// Fixture 9: multiple violations in one file are counted independently
// ---------------------------------------------------------------------------
{
  const dir = setupFixtureDir();
  writeFileSync(
    join(dir, 'apps/api/src/app/x.controller.ts'),
    `import { Controller, Get, Post, Req } from '@nestjs/common';\nimport { Request } from 'express';\n\n@Controller('x')\nexport class XController {\n  @Get()\n  list(@Req() req: any) { return req.user; }\n\n  @Post()\n  create(@Req() req: Request) { return req.url; }\n}\n`,
  );
  const r = runScanner(dir);
  assertTrue(r.code === 1, 'multiple violations: scanner exits 1');
  assertTrue(r.stdout.includes('"total":2'), 'multiple violations: 2 violations counted');
}

console.log(`no-untyped-req selftest: ${assertions}/${assertions} assertions`);
