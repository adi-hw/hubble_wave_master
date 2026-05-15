import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function run(content: string): { code: number; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), 'abaccov-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/test.controller.ts'), content);
  try {
    const stdout = execSync(`npx tsx tools/scanners/abac-coverage-check.ts --root=${dir}`, { encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (e: any) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? '' };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// Fail: class uses AbacGuard but method has no abac/skip/public/authenticated
const r1 = run(`@Controller('x')
@UseGuards(AbacGuard)
export class XController {
  @Get()
  list() {}
}`);
console.assert(r1.code !== 0, 'unannotated handler under AbacGuard should fail');

// Pass: class uses AbacGuard, method has @AbacResource
const r2 = run(`@Controller('x')
@UseGuards(AbacGuard)
export class XController {
  @AbacResource('records', 'list')
  @Get()
  list() {}
}`);
console.assert(r2.code === 0, 'annotated handler under AbacGuard should pass');

// Pass: class does NOT use AbacGuard — out of scope for this scanner
const r3 = run(`@Controller('x')
export class XController {
  @Get()
  list() {}
}`);
console.assert(r3.code === 0, 'controller without AbacGuard is out of scope');

console.log('abac-coverage-check selftest: 3/3 assertions');
