import * as fs from 'fs';
import * as path from 'path';

interface ApprovedDeps {
  approved: {
    production: Record<string, { reason: string }>;
    development: Record<string, { reason: string }>;
  };
  banned: Record<string, { reason: string }>;
  legacy?: Record<string, { reason: string }>;
}

function main() {
  const root = process.cwd();
  const pkgPath = path.join(root, 'package.json');
  const registryPath = path.join(root, 'tools', 'approved-deps.json');

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const approved = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as ApprovedDeps;

  const allApproved = new Set([
    ...Object.keys(approved.approved.production),
    ...Object.keys(approved.approved.development),
  ]);
  const banned = approved.banned;
  const legacy = approved.legacy ?? {};

  const violations: string[] = [];
  const warnings: string[] = [];

  const evaluate = (dep: string, label: 'dep' | 'devDep') => {
    const tag = label === 'devDep' ? ' (devDep)' : '';
    if (banned[dep]) {
      if (legacy[dep]) {
        warnings.push(
          `LEGACY${tag}: ${dep} - ${legacy[dep].reason} (banned: ${banned[dep].reason})`,
        );
        return;
      }
      violations.push(`BANNED${tag}: ${dep} - ${banned[dep].reason}`);
      return;
    }
    if (!allApproved.has(dep) && !dep.startsWith('@types/')) {
      violations.push(
        `UNAPPROVED${tag}: ${dep} - add to tools/approved-deps.json with a 'reason' field, or remove`,
      );
    }
  };

  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    evaluate(dep, 'dep');
  }
  for (const dep of Object.keys(pkg.devDependencies ?? {})) {
    evaluate(dep, 'devDep');
  }

  if (warnings.length > 0) {
    console.warn(`approved-deps check: ${warnings.length} legacy carve-out(s) tracked for removal`);
    for (const w of warnings) {
      console.warn(`  ${w}`);
    }
  }

  if (violations.length === 0) {
    console.log('approved-deps check: ok');
    process.exit(0);
  }

  console.error(`approved-deps check: FAILED (${violations.length} violations)`);
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

main();
