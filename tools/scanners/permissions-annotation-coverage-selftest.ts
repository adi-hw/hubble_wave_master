import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function runFixture(controllerContent: string): { code: number; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'permcov-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/users.controller.ts'), controllerContent);
  try {
    const stdout = execSync(`npx tsx tools/scanners/permissions-annotation-coverage.ts --root=${dir} --ci`, { encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (e: any) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Fixture 1: all handlers annotated — should report annotated=1, unannotated=0
const annotated = `@Controller('users')
export class UsersController {
  @RequirePermission('users.view')
  @Get()
  list() {}
}`;
const r1 = runFixture(annotated);
console.assert(r1.code === 0, 'annotated handler: scanner exits 0 (reporting-only)');
console.assert(r1.stdout.includes('"annotated":1'), 'annotated handler: annotated count = 1');

// Fixture 2: no annotation on handler — scanner must still exit 0 (reporting-only, never CI-blocking)
const unannotated = `@Controller('users')
export class UsersController {
  @Get()
  list() {}
}`;
const r2 = runFixture(unannotated);
console.assert(r2.code === 0, 'unannotated handler: scanner exits 0 (never fails CI)');
console.assert(r2.stdout.includes('"unannotated":1'), 'unannotated handler: unannotated count = 1');

console.log('permissions-annotation-coverage selftest: 4/4 assertions');
