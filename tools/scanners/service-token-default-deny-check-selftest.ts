import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function runFixture(controllerContent: string): { code: number; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'stdd-'));
  mkdirSync(join(dir, 'apps/svc/src/app'), { recursive: true });
  writeFileSync(join(dir, 'apps/svc/src/app/x.controller.ts'), controllerContent);
  try {
    const stdout = execSync(
      `npx tsx tools/scanners/service-token-default-deny-check.ts --root=${dir} --ci`,
      { encoding: 'utf8' },
    );
    return { code: 0, stdout };
  } catch (e) {
    const err = e as { status?: number; stdout?: Buffer | string };
    return {
      code: err.status ?? 1,
      stdout: err.stdout?.toString() ?? '',
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
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
// Fixture 1: @AllowServiceToken + @RequireServiceScope at the SAME method
// ---------------------------------------------------------------------------
const paired = `import { Controller, Get } from '@nestjs/common';
import { AllowServiceToken, RequireServiceScope } from '@hubblewave/auth-guard';

@Controller('x')
export class XController {
  @AllowServiceToken()
  @RequireServiceScope('analytics.events.ingest')
  @Get()
  ingest() {}
}`;
const r1 = runFixture(paired);
assertTrue(r1.code === 0, 'method-level pair: scanner exits 0');
assertTrue(r1.stdout.includes('"total":0'), 'method-level pair: 0 violations');

// ---------------------------------------------------------------------------
// Fixture 2: @AllowServiceToken alone — missing @RequireServiceScope
// ---------------------------------------------------------------------------
const unpaired = `import { Controller, Get } from '@nestjs/common';
import { AllowServiceToken } from '@hubblewave/auth-guard';

@Controller('x')
export class XController {
  @AllowServiceToken()
  @Get()
  ingest() {}
}`;
const r2 = runFixture(unpaired);
assertTrue(r2.code === 1, 'unpaired @AllowServiceToken: scanner exits 1');
assertTrue(r2.stdout.includes('"total":1'), 'unpaired @AllowServiceToken: 1 violation');
assertTrue(
  r2.stdout.includes('@RequireServiceScope'),
  'unpaired @AllowServiceToken: violation message mentions @RequireServiceScope',
);

// ---------------------------------------------------------------------------
// Fixture 3: @RequireServiceScope at CLASS level covers method-level @AllowServiceToken
// ---------------------------------------------------------------------------
const classLevelScope = `import { Controller, Get } from '@nestjs/common';
import { AllowServiceToken, RequireServiceScope } from '@hubblewave/auth-guard';

@Controller('x')
@RequireServiceScope('analytics.events.ingest')
export class XController {
  @AllowServiceToken()
  @Get()
  ingest() {}
}`;
const r3 = runFixture(classLevelScope);
assertTrue(r3.code === 0, 'class-level @RequireServiceScope: scanner exits 0');
assertTrue(r3.stdout.includes('"total":0'), 'class-level @RequireServiceScope: 0 violations');

// ---------------------------------------------------------------------------
// Fixture 4: @AllowServiceToken with an EMPTY scope code — still a violation
// (the regex requires a non-empty literal between the quotes)
// ---------------------------------------------------------------------------
const emptyScope = `import { Controller, Get } from '@nestjs/common';
import { AllowServiceToken, RequireServiceScope } from '@hubblewave/auth-guard';

@Controller('x')
export class XController {
  @AllowServiceToken()
  @RequireServiceScope('')
  @Get()
  ingest() {}
}`;
const r4 = runFixture(emptyScope);
assertTrue(r4.code === 1, 'empty scope literal: scanner exits 1');
assertTrue(r4.stdout.includes('"total":1'), 'empty scope literal: 1 violation');

// ---------------------------------------------------------------------------
// Fixture 5: controller with NO @AllowServiceToken at all is silently ok
// (it never accepts service tokens; the rule does not apply)
// ---------------------------------------------------------------------------
const noServiceToken = `import { Controller, Get } from '@nestjs/common';

@Controller('x')
export class XController {
  @Get()
  ingest() {}
}`;
const r5 = runFixture(noServiceToken);
assertTrue(r5.code === 0, 'no @AllowServiceToken: scanner exits 0');
assertTrue(r5.stdout.includes('"total":0'), 'no @AllowServiceToken: 0 violations');

// ---------------------------------------------------------------------------
// Fixture 6: multiple @AllowServiceToken handlers in one controller — each
// must have its own pair (one paired, one missing)
// ---------------------------------------------------------------------------
const mixed = `import { Controller, Get, Post } from '@nestjs/common';
import { AllowServiceToken, RequireServiceScope } from '@hubblewave/auth-guard';

@Controller('x')
export class XController {
  @AllowServiceToken()
  @RequireServiceScope('a.read')
  @Get()
  good() {}

  @AllowServiceToken()
  @Post()
  bad() {}
}`;
const r6 = runFixture(mixed);
assertTrue(r6.code === 1, 'mixed paired+unpaired: scanner exits 1');
assertTrue(r6.stdout.includes('"total":1'), 'mixed paired+unpaired: exactly 1 violation');

console.log(`service-token-default-deny selftest: ${assertions}/${assertions} assertions`);
