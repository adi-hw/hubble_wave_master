#!/usr/bin/env tsx
/**
 * route-boundary-coverage-check
 *
 * AST-aware coverage scanner for the canon §28 route-boundary contract.
 * For every HTTP handler under `apps/api/src/**` and
 * `apps/control-plane/src/**`, the scanner verifies that EXACTLY ONE
 * primary boundary decorator is attached at either the method or
 * class level:
 *
 *   - `@RequirePermission(code)` — capability gate via PermissionsGuard.
 *   - `@RequireCollectionAccess({verb, collection, record?})` — data-ACL
 *     gate via CollectionAccessGuard.
 *   - `@AuthenticatedOnly()` — authenticated identity sufficient.
 *   - `@Public()` — intentionally open; no authentication required.
 *
 * Mutual-exclusion rules:
 *   - `@Public` MUST NOT combine with any other primary.
 *   - `@RequirePermission` + `@RequireCollectionAccess` MUST NOT
 *     co-occur on the same handler (they target different evaluation
 *     surfaces; a handler that legitimately needs both should split).
 *   - `@AuthenticatedOnly` MUST NOT combine with `@Roles` /
 *     `@RequirePermission` / `@RequireCollectionAccess`.
 *   - `@Roles(...)` is AUXILIARY — it pairs with a primary, never
 *     stands alone. A handler with only `@Roles` and no primary is
 *     bare and fails the scanner.
 *
 * Capability code check (when `@RequirePermission(code)`):
 *   - `code` MUST exist in `libs/permission-registry`'s
 *     `PERMISSION_REGISTRY` constant.
 *
 * Untyped `@Req()` check:
 *   - Any `@Req() req: any` or bare `@Req() req: Request` parameter
 *     fails (mirrors the `no-untyped-req-check` scanner; the
 *     coverage scanner subsumes that gate for handler-level use).
 *
 * Mode (Stream 3 PR1 lands reporting-only):
 *   - Default: exit 0, write the structured report to
 *     `dist/route-boundary-report.json` (a JSON file CI builds can
 *     attach as an artefact). The scanner outputs a human summary
 *     plus the file path.
 *   - `--strict`: exit non-zero on any failure. Stream 3 PR-final
 *     wires this once the sweep completes.
 *
 * Allowlist: `tools/scanners/route-boundary-coverage-allowlist.json`.
 * Each entry `{ target, rationale, addedBy, addedAt, followUp? }`
 * with `target` of the form `Path/To/Controller.methodName`.
 * Allowlists shrink over time; new entries require a follow-up
 * reference per scanner-convention README.
 *
 * Implementation: ts-morph traversal. The scanner is intentionally
 * heavier than the existing regex scanners — the route-boundary
 * contract spans multiple decorator combinations and requires
 * accurate parameter type extraction, which is brittle in pure
 * regex.
 *
 * Usage:
 *   npx tsx tools/scanners/route-boundary-coverage-check.ts           (human, reporting)
 *   npx tsx tools/scanners/route-boundary-coverage-check.ts --ci      (JSON, reporting)
 *   npx tsx tools/scanners/route-boundary-coverage-check.ts --strict  (hard gate)
 *   npx tsx tools/scanners/route-boundary-coverage-check.ts --root=path
 */
import { readFileSync, readdirSync, mkdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { join, relative, resolve } from 'path';
import { Project, SourceFile, ClassDeclaration, MethodDeclaration, SyntaxKind, ParameterDeclaration } from 'ts-morph';

interface AllowlistEntry {
  target: string;
  rationale: string;
  addedBy: string;
  addedAt: string;
  followUp?: string;
}

interface Allowlist {
  entries: AllowlistEntry[];
}

type FailureReason =
  | 'no-primary-boundary'
  | 'multiple-primary-boundaries'
  | 'public-with-other-primary'
  | 'permission-with-collection-access'
  | 'authenticated-only-with-roles-or-permission'
  | 'bare-roles-no-primary'
  | 'unregistered-permission'
  | 'invalid-collection-access-options'
  | 'untyped-req-any'
  | 'untyped-req-bare-request';

interface Failure {
  file: string;
  line: number;
  target: string;
  reason: FailureReason;
  detail: string;
}

interface HandlerReport {
  file: string;
  line: number;
  target: string;
  primaries: string[];
  hasRoles: boolean;
  permissionCodes: string[];
  failures: FailureReason[];
}

const HTTP_DECORATORS = new Set([
  'Get',
  'Post',
  'Put',
  'Patch',
  'Delete',
  'All',
  'Options',
  'Head',
  'Sse',
]);

const PRIMARY_BOUNDARY = new Set([
  'RequirePermission',
  'RequireCollectionAccess',
  'AuthenticatedOnly',
  'Public',
]);

const ROLES_DECORATOR = 'Roles';

const SCAN_ROOTS = ['apps/api/src', 'apps/control-plane/src'];
const IGNORE_SUFFIXES = ['.spec.ts', '.test.ts', '.d.ts'];

function parseArgs(argv: string[]): {
  root: string;
  ci: boolean;
  strict: boolean;
  scanRoots: string[];
  fixturesRoot: string | null;
} {
  let root = '.';
  let ci = false;
  let strict = false;
  let fixturesRoot: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith('--root=')) root = arg.slice('--root='.length);
    else if (arg === '--ci') ci = true;
    else if (arg === '--strict') strict = true;
    else if (arg.startsWith('--fixtures=')) {
      fixturesRoot = arg.slice('--fixtures='.length);
    }
  }
  return {
    root,
    ci,
    strict,
    scanRoots: fixturesRoot ? [fixturesRoot] : SCAN_ROOTS,
    fixturesRoot,
  };
}

function loadAllowlist(root: string): Set<string> {
  const path = join(root, 'tools/scanners/route-boundary-coverage-allowlist.json');
  try {
    const al: Allowlist = JSON.parse(readFileSync(path, 'utf8'));
    return new Set(al.entries.map((e) => e.target));
  } catch {
    return new Set();
  }
}

/**
 * Extract `PERMISSION_REGISTRY` codes from the registry source file by
 * a literal `code: '...'` regex. Mirrors the same approach
 * `permission-registry-sync-check.ts` uses — keeps the scanner free of
 * a runtime import of the registry (which would require building the
 * library first).
 */
function loadRegistryCodes(root: string): Set<string> {
  const path = join(
    root,
    'libs/permission-registry/src/lib/registry.ts',
  );
  if (!existsSync(path)) return new Set();
  const src = readFileSync(path, 'utf8');
  const codes = new Set<string>();
  for (const line of src.split('\n')) {
    const stripped = line.trim();
    if (stripped.startsWith('//') || stripped.startsWith('*')) continue;
    const m = /\bcode\s*:\s*['"]([^'"]+)['"]/.exec(line);
    if (m) codes.add(m[1]);
  }
  return codes;
}

function isControllerClass(klass: ClassDeclaration): boolean {
  return klass.getDecorators().some((d) => d.getName() === 'Controller');
}

function decoratorNames(node: { getDecorators: () => Array<{ getName: () => string }> }): string[] {
  return node.getDecorators().map((d) => d.getName());
}

function getStringArgument(
  decorator: { getArguments: () => Array<{ getText: () => string; getKind: () => SyntaxKind }> },
  index = 0,
): string | null {
  const args = decorator.getArguments();
  const arg = args[index];
  if (!arg) return null;
  const text = arg.getText().trim();
  const m = /^['"]([^'"]+)['"]$/.exec(text);
  return m ? m[1] : null;
}

function analyzeHandler(
  klass: ClassDeclaration,
  method: MethodDeclaration,
  registryCodes: Set<string>,
  file: string,
): { report: HandlerReport; failures: Failure[] } {
  const classDecs = decoratorNames(klass);
  const methodDecs = decoratorNames(method);

  // Method-level decorators override class-level for primary boundary
  // detection (matches Reflector.getAllAndOverride semantics in the
  // guards). However for the coverage scanner we treat the EFFECTIVE
  // set as method-decorators-if-any-primary-present, otherwise
  // class-level. Same logic as the plan pseudocode.
  const methodPrimary = methodDecs.filter((n) => PRIMARY_BOUNDARY.has(n));
  const effectivePrimaries =
    methodPrimary.length > 0
      ? methodPrimary
      : classDecs.filter((n) => PRIMARY_BOUNDARY.has(n));

  const hasRolesAtMethod = methodDecs.includes(ROLES_DECORATOR);
  const hasRolesAtClass = classDecs.includes(ROLES_DECORATOR);
  const hasRoles = hasRolesAtMethod || hasRolesAtClass;

  // Collect all @RequirePermission codes (method first, falling back to
  // class — same effective semantics as `Reflector.getAllAndOverride`).
  // Handles both call shapes:
  //   - @RequirePermission('code')
  //   - @RequirePermission('a', 'b', ...)
  //   - @RequirePermission(['a', 'b'], 'any' | 'all')
  // The mode marker `'any' | 'all'` is excluded from the code list.
  const requirePermissionDecorators = (methodPrimary.includes('RequirePermission')
    ? method.getDecorators()
    : klass.getDecorators()
  ).filter((d) => d.getName() === 'RequirePermission');
  const MODE_MARKERS = new Set(['any', 'all']);
  const permissionCodes: string[] = [];
  for (const d of requirePermissionDecorators) {
    const args = d.getArguments();
    for (const arg of args) {
      const text = arg.getText().trim();
      // Array form: @RequirePermission(['a', 'b'], 'mode')
      if (text.startsWith('[')) {
        const re = /['"]([^'"]+)['"]/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          if (!MODE_MARKERS.has(m[1])) permissionCodes.push(m[1]);
        }
        continue;
      }
      // Plain string form: @RequirePermission('a')
      const m = /^['"]([^'"]+)['"]$/.exec(text);
      if (m && !MODE_MARKERS.has(m[1])) {
        permissionCodes.push(m[1]);
      }
    }
  }

  const target = `${klass.getName() ?? '<anonymous>'}.${method.getName()}`;
  const lineNumber = method.getStartLineNumber();
  const failures: FailureReason[] = [];

  // Rule 1: exactly one primary required (zero is fail; multiple is fail).
  if (effectivePrimaries.length === 0) {
    failures.push('no-primary-boundary');
  } else if (effectivePrimaries.length > 1) {
    failures.push('multiple-primary-boundaries');
  }

  // Rule 2: @Public must stand alone among primaries.
  if (
    effectivePrimaries.includes('Public') &&
    effectivePrimaries.some((n) => n !== 'Public')
  ) {
    failures.push('public-with-other-primary');
  }

  // Rule 3: @RequirePermission + @RequireCollectionAccess together is
  // a conflict (they target different evaluation surfaces).
  if (
    effectivePrimaries.includes('RequirePermission') &&
    effectivePrimaries.includes('RequireCollectionAccess')
  ) {
    failures.push('permission-with-collection-access');
  }

  // Rule 4: @AuthenticatedOnly + @Roles/@RequirePermission/
  // @RequireCollectionAccess is a conflict.
  if (effectivePrimaries.includes('AuthenticatedOnly')) {
    if (
      hasRoles ||
      effectivePrimaries.includes('RequirePermission') ||
      effectivePrimaries.includes('RequireCollectionAccess')
    ) {
      failures.push('authenticated-only-with-roles-or-permission');
    }
  }

  // Rule 5: bare @Roles without a primary is fail.
  if (effectivePrimaries.length === 0 && hasRoles) {
    // Replace the no-primary-boundary failure with a more specific one.
    const idx = failures.indexOf('no-primary-boundary');
    if (idx >= 0) failures.splice(idx, 1);
    failures.push('bare-roles-no-primary');
  }

  // Rule 6: every @RequirePermission code must be in PERMISSION_REGISTRY
  // (if a registry exists).
  if (effectivePrimaries.includes('RequirePermission') && registryCodes.size > 0) {
    for (const code of permissionCodes) {
      if (!registryCodes.has(code)) {
        failures.push('unregistered-permission');
        break;
      }
    }
  }

  // Rule 7: @Req() parameter type — if `any` or bare `Request`, fail.
  const reqParamFailure = checkReqParam(method);
  if (reqParamFailure) failures.push(reqParamFailure);

  const report: HandlerReport = {
    file,
    line: lineNumber,
    target,
    primaries: effectivePrimaries,
    hasRoles,
    permissionCodes,
    failures,
  };

  const failureList: Failure[] = failures.map((reason) => ({
    file,
    line: lineNumber,
    target,
    reason,
    detail: failureDetail(reason, effectivePrimaries, permissionCodes, registryCodes),
  }));

  return { report, failures: failureList };
}

function checkReqParam(method: MethodDeclaration): FailureReason | null {
  const params = method.getParameters();
  for (const param of params) {
    const decs = decoratorNames(param);
    if (!decs.includes('Req') && !decs.includes('Request')) continue;
    const failure = classifyReqParamType(param);
    if (failure) return failure;
  }
  return null;
}

function classifyReqParamType(
  param: ParameterDeclaration,
): FailureReason | null {
  const typeNode = param.getTypeNode();
  if (!typeNode) return null;
  const typeText = typeNode.getText().trim();
  if (typeText === 'any') return 'untyped-req-any';
  if (typeText === 'Request') return 'untyped-req-bare-request';
  return null;
}

function failureDetail(
  reason: FailureReason,
  primaries: string[],
  permissionCodes: string[],
  registryCodes: Set<string>,
): string {
  switch (reason) {
    case 'no-primary-boundary':
      return 'Handler has no primary boundary decorator (@RequirePermission / @RequireCollectionAccess / @AuthenticatedOnly / @Public).';
    case 'multiple-primary-boundaries':
      return `Handler has multiple primary boundary decorators: [${primaries.join(', ')}]. Choose exactly one.`;
    case 'public-with-other-primary':
      return `@Public must stand alone; remove the other primary boundary decorator(s) [${primaries.filter((p) => p !== 'Public').join(', ')}].`;
    case 'permission-with-collection-access':
      return '@RequirePermission and @RequireCollectionAccess cannot co-occur on the same handler — they target different evaluation surfaces. Split the route or pick one.';
    case 'authenticated-only-with-roles-or-permission':
      return '@AuthenticatedOnly cannot co-occur with @Roles / @RequirePermission / @RequireCollectionAccess.';
    case 'bare-roles-no-primary':
      return '@Roles is auxiliary; pair it with one of @RequirePermission / @RequireCollectionAccess / @AuthenticatedOnly / @Public.';
    case 'unregistered-permission': {
      const offenders = permissionCodes.filter((c) => !registryCodes.has(c));
      return `@RequirePermission code(s) not in PERMISSION_REGISTRY: [${offenders.join(', ')}]. Add to libs/permission-registry/src/lib/registry.ts or update the call site to a registered code.`;
    }
    case 'invalid-collection-access-options':
      return '@RequireCollectionAccess options are missing required fields ({verb, collection: {from, name, kind}}).';
    case 'untyped-req-any':
      return '@Req() parameter typed as `any` — bypasses the discriminated-union RequestContext narrowing JwtAuthGuard populates.';
    case 'untyped-req-bare-request':
      return '@Req() parameter typed as bare `Request` — missing the request.context augmentation. Use InstanceRequest / AuthenticatedRequest, or parameterize as `Request<...>`.';
  }
}

/**
 * Recursive directory walker that adds candidate source files to the
 * ts-morph Project. Used instead of `addSourceFilesAtPaths` glob because
 * minimatch's globbing doesn't reliably handle Windows absolute paths
 * with drive letters.
 */
function walkAndAdd(dir: string, project: Project, includeAll: boolean): void {
  const IGNORE_DIRS = new Set([
    'node_modules',
    'dist',
    '.git',
    '.claude',
    'tmp',
    '.nx',
  ]);
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (IGNORE_DIRS.has(entry)) continue;
      walkAndAdd(full, project, includeAll);
      continue;
    }
    if (!entry.endsWith('.ts') || entry.endsWith('.d.ts')) continue;
    if (entry.endsWith('.spec.ts') || entry.endsWith('.test.ts')) continue;
    if (!includeAll && !entry.endsWith('.controller.ts')) continue;
    project.addSourceFileAtPath(full);
  }
}

function walkControllers(
  project: Project,
  registryCodes: Set<string>,
  rootForRelative: string,
): { reports: HandlerReport[]; failures: Failure[] } {
  const reports: HandlerReport[] = [];
  const failures: Failure[] = [];
  for (const source of project.getSourceFiles()) {
    const sourceFile: SourceFile = source;
    const path = sourceFile.getFilePath();
    if (IGNORE_SUFFIXES.some((suffix) => path.endsWith(suffix))) continue;
    for (const klass of sourceFile.getClasses()) {
      if (!isControllerClass(klass)) continue;
      const relPath = relative(rootForRelative, path).split('\\').join('/');
      for (const method of klass.getMethods()) {
        const httpDec = method
          .getDecorators()
          .find((d) => HTTP_DECORATORS.has(d.getName()));
        if (!httpDec) continue;
        const { report, failures: failureList } = analyzeHandler(
          klass,
          method,
          registryCodes,
          relPath,
        );
        reports.push(report);
        failures.push(...failureList);
      }
    }
  }
  return { reports, failures };
}

function main() {
  const { root, ci, strict, scanRoots, fixturesRoot } = parseArgs(
    process.argv.slice(2),
  );

  const allowedTargets = loadAllowlist(root);
  const registryCodes = loadRegistryCodes(root);

  const tsConfig = join(root, 'tsconfig.base.json');
  const project = new Project({
    tsConfigFilePath: existsSync(tsConfig) ? tsConfig : undefined,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: {
      allowJs: false,
      noEmit: true,
    },
  });

  const rootAbs = resolve(root);
  for (const scanRoot of scanRoots) {
    const abs = resolve(root, scanRoot);
    if (!existsSync(abs)) continue;
    // Walk the directory tree manually and add `.controller.ts` files
    // (plus all `.ts` files when running against a fixture root, since
    // fixtures may use bare names). Direct globbing via
    // `addSourceFilesAtPaths` is unreliable on Windows once paths
    // include a drive letter (`C:/...`) — minimatch treats the colon
    // as a special character. Per-file `addSourceFileAtPath` calls
    // sidestep the issue.
    const wantAll = fixturesRoot !== null;
    walkAndAdd(abs, project, wantAll);
  }

  const { reports, failures: rawFailures } = walkControllers(
    project,
    registryCodes,
    rootAbs,
  );

  // Apply allowlist suppression: an entry suppresses ALL failures for
  // the matching target. (Granular suppression per-reason is a future
  // option; binary suppression is enough for the Stream 3 sweep.)
  const failures = rawFailures.filter((f) => !allowedTargets.has(f.target));

  // Write the structured report to dist for CI artefact pickup.
  const reportDir = join(rootAbs, 'dist');
  const reportPath = join(reportDir, 'route-boundary-report.json');
  if (!fixturesRoot) {
    try {
      mkdirSync(reportDir, { recursive: true });
      writeFileSync(
        reportPath,
        JSON.stringify(
          {
            handlerCount: reports.length,
            failureCount: failures.length,
            allowlistedCount: rawFailures.length - failures.length,
            registrySize: registryCodes.size,
            failures,
          },
          null,
          2,
        ),
      );
    } catch {
      // Best-effort — fall back to stdout-only.
    }
  }

  if (ci) {
    console.log(
      JSON.stringify({
        handlerCount: reports.length,
        failureCount: failures.length,
        failures,
      }),
    );
  } else {
    console.log(
      `route-boundary-coverage-check: ${reports.length} handler(s) scanned; ${failures.length} unallowed failure(s)`,
    );
    if (failures.length > 0) {
      const byReason = new Map<FailureReason, Failure[]>();
      for (const f of failures) {
        const bucket = byReason.get(f.reason) ?? [];
        bucket.push(f);
        byReason.set(f.reason, bucket);
      }
      for (const [reason, list] of byReason.entries()) {
        console.log(`\n${reason} (${list.length}):`);
        for (const f of list.slice(0, 5)) {
          console.log(`  ${f.file}:${f.line}  ${f.target}`);
          console.log(`    ${f.detail}`);
        }
        if (list.length > 5) {
          console.log(`  ... and ${list.length - 5} more`);
        }
      }
      if (!strict) {
        console.log(
          `\nMode: reporting-only — exiting 0. Stream 3 PR-final flips to --strict.`,
        );
      }
      if (!fixturesRoot) {
        console.log(`\nFull report: ${reportPath}`);
      }
    } else {
      console.log('  all handlers covered');
    }
  }

  if (strict && failures.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

const isMain =
  process.argv[1] &&
  process.argv[1].endsWith('route-boundary-coverage-check.ts');
if (isMain) {
  main();
}

export { analyzeHandler, walkControllers, type Failure, type HandlerReport };
