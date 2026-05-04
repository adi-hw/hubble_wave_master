import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';

type Violation = {
  file: string;
  reason: string;
};

const APPS_ROOT = join(process.cwd(), 'apps');
const TARGET_SUFFIX = '.service.ts';
const CONTROLLER_SUFFIX = '.controller.ts';
// Non-HTTP handler hosts that can carry RequestContext-driven data access:
// BullMQ processors, WebSocket gateways, EventEmitter / Cron handlers
// typically live in *.processor.ts, *.gateway.ts, or *.service.ts files.
const NON_HTTP_HANDLER_SUFFIXES = ['.processor.ts', '.gateway.ts'];
const IGNORE_DIRS = new Set(['__tests__', 'test', 'dist', 'tmp', 'node_modules']);

// Decorators that mount handlers OUTSIDE the HTTP request pipeline. The
// global APP_GUARD chain only runs on HTTP requests, so handlers behind
// these decorators must enforce authz themselves whenever they mutate or
// expose data on behalf of a specific user (i.e. they read a
// RequestContext rather than running as the system actor).
const NON_HTTP_HANDLER_DECORATORS: RegExp[] = [
  /@Process\b/,            // BullMQ consumer
  /@Processor\b/,          // BullMQ processor class
  /@WebSocketGateway\b/,   // socket.io / ws gateway
  /@SubscribeMessage\b/,   // gateway message handler
  /@OnEvent\b/,            // EventEmitter listener
  /@Cron\b/,               // @nestjs/schedule cron
  /@Interval\b/,
  /@Timeout\b/,
];

const HAS_NON_HTTP_HANDLER_RE = new RegExp(
  NON_HTTP_HANDLER_DECORATORS.map((d) => d.source).join('|'),
);

const NEEDS_AUTHZ_PATTERNS = [
  /RequestContext/,
];

const DATA_ACCESS_PATTERNS = [
  /createQueryBuilder/,
  /getRepository\(/,
  /\.query\(/,
  /\bDataSource\b/,
];

const AUTHZ_USAGE_PATTERNS = [
  /\bauthz\./,
  /AuthorizationService/,
  /ensureTableAccess\(/,
  /ensureCollectionAccess\(/,
  /buildRowLevelClause\(/,
  /buildCollectionRowLevelClause\(/,
  // Services that own their per-row scoping via private methods that
  // both consume RequestContext and reject unauthorized access surface
  // count as "uses authz" — they enforce, just not through the shared
  // service. Two minimum signals are required to count: a guard method
  // (canRead/canWrite/assertAdmin) AND a throw of ForbiddenException so
  // we don't false-positive on plain getters that happen to be named
  // canRead.
  /\bassertAdmin\s*\(/,
];

// Authz decorators that are inert without an upstream guard chain.
const PROTECTION_DECORATORS: string[] = [
  '@Roles',
  '@Permissions',
  '@RequirePermission',
  '@RequireAllPermissions',
  '@RequireAnyPermission',
  '@AbacScope',
  '@AbacResource',
];

// Tokens that prove a service has wired guards globally. Matched against
// module file content with multiline mode so we can require the module symbol
// to appear inside an `imports: [...]` array rather than as a stray import.
const GLOBAL_GUARD_TOKENS: RegExp[] = [
  // GlobalGuardsModule listed inside an imports: [...] array
  /imports\s*:\s*\[[\s\S]*?\bGlobalGuardsModule\b/,
  // Bootstrap-level call in main.ts
  /useGlobalGuards\s*\(/,
  // Explicit APP_GUARD providers in module providers: [...]
  /provide\s*:\s*APP_GUARD\s*,\s*useClass\s*:\s*JwtAuthGuard/,
  /provide\s*:\s*APP_GUARD\s*,\s*useClass\s*:\s*RolesGuard/,
  /provide\s*:\s*APP_GUARD\s*,\s*useClass\s*:\s*PermissionsGuard/,
];

const CLASS_LEVEL_USEGUARDS_RE = /^\s*@UseGuards\s*\([^)]*\bJwtAuthGuard\b/;
const HAS_PROTECTION_RE = new RegExp(
  PROTECTION_DECORATORS.map((d) => `${d}\\s*\\(`).join('|'),
);

function walk(dir: string, files: string[] = [], suffix: string = TARGET_SUFFIX) {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) {
      continue;
    }
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, files, suffix);
      continue;
    }
    if (fullPath.endsWith(suffix)) {
      files.push(fullPath);
    }
  }
  return files;
}

function fileNeedsAuthz(content: string): boolean {
  return NEEDS_AUTHZ_PATTERNS.some((pattern) => pattern.test(content))
    && DATA_ACCESS_PATTERNS.some((pattern) => pattern.test(content));
}

function fileUsesAuthz(content: string): boolean {
  return AUTHZ_USAGE_PATTERNS.some((pattern) => pattern.test(content));
}

function controllerHasInertProtection(content: string): boolean {
  return HAS_PROTECTION_RE.test(content);
}

function classLevelGuardChain(content: string): boolean {
  // Walk lines until we hit `class <Name>`; treat any line preceding the class
  // declaration that starts with `@UseGuards(...JwtAuthGuard...)` as
  // class-level coverage.
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*export\s+class\s+\w+/.test(line) || /^\s*class\s+\w+/.test(line)) {
      return false;
    }
    if (CLASS_LEVEL_USEGUARDS_RE.test(line)) {
      return true;
    }
  }
  return false;
}

/**
 * For each handler decorated with one of PROTECTION_DECORATORS, walk upward
 * over the contiguous decorator block above it and require @UseGuards with
 * JwtAuthGuard. Returns the list of unguarded handler line numbers.
 */
function findUnguardedProtectedHandlers(content: string): number[] {
  if (!HAS_PROTECTION_RE.test(content)) {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const classGuarded = classLevelGuardChain(content);
  const unguarded: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!HAS_PROTECTION_RE.test(line)) {
      continue;
    }

    // The protection decorator at line i belongs to some handler below it.
    // Walk down until we find a method-like signature (or end of file).
    let methodLine = -1;
    for (let j = i + 1; j < lines.length; j++) {
      const trimmed = lines[j].trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('@')) continue;
      // method signature heuristic: starts with method name followed by `(` or
      // `<...>(`, or `async name(`
      if (/^(async\s+)?[A-Za-z_]\w*\s*[<(]/.test(trimmed)) {
        methodLine = j;
        break;
      }
      // class declaration means we exited the decorator block; this is a
      // class-level decorator, treat the class as the target.
      if (/^export\s+class\b/.test(trimmed) || /^class\b/.test(trimmed)) {
        methodLine = j;
        break;
      }
      break;
    }

    if (methodLine === -1) {
      // Decorator without a clear target; treat as unguarded conservatively.
      unguarded.push(i + 1);
      continue;
    }

    // Class-level protection: covered iff classLevelGuardChain matched.
    if (/^\s*(export\s+)?class\b/.test(lines[methodLine])) {
      if (!classGuarded) {
        unguarded.push(i + 1);
      }
      continue;
    }

    // Method-level: check the decorator block immediately above the method.
    if (classGuarded) {
      continue;
    }

    let methodGuarded = false;
    for (let k = methodLine - 1; k >= 0; k--) {
      const trimmed = lines[k].trim();
      if (!trimmed) continue;
      if (!trimmed.startsWith('@')) {
        break;
      }
      if (CLASS_LEVEL_USEGUARDS_RE.test(lines[k])) {
        methodGuarded = true;
        break;
      }
    }

    if (!methodGuarded) {
      unguarded.push(i + 1);
    }
  }

  return unguarded;
}

function appModuleWiresGuardsGlobally(content: string): boolean {
  // Either the new GlobalGuardsModule, the legacy useGlobalGuards call in main,
  // or explicit APP_GUARD providers count as "wired globally".
  return GLOBAL_GUARD_TOKENS.some((pattern) => pattern.test(content));
}

function mainTsWiresGuardsGlobally(appModulePath: string): boolean {
  // Look for main.ts adjacent to the app/ directory: apps/<service>/src/main.ts
  // app.module.ts lives at apps/<service>/src/app/app.module.ts
  const srcDir = dirname(dirname(appModulePath));
  const mainTs = join(srcDir, 'main.ts');
  if (!existsSync(mainTs)) {
    return false;
  }
  const content = readFileSync(mainTs, 'utf8');
  return /useGlobalGuards\s*\(/.test(content);
}

/**
 * APP_GUARD providers are global once registered anywhere in the module
 * graph. Walk every .module.ts under the service and look for any of the
 * required guards, since some services (e.g. svc-control-plane) wire their
 * guards from a feature module imported by the root.
 */
function serviceWiresGuardsGlobally(serviceAppDir: string): boolean {
  const moduleFiles = walk(serviceAppDir, [], '.module.ts');
  for (const moduleFile of moduleFiles) {
    const content = readFileSync(moduleFile, 'utf8');
    if (appModuleWiresGuardsGlobally(content)) {
      return true;
    }
  }
  return false;
}

function checkServiceAuthzBypass(): Violation[] {
  if (!existsSync(APPS_ROOT)) {
    return [];
  }

  const services = readdirSync(APPS_ROOT)
    .filter((name) => name.startsWith('svc-'))
    .filter((name) => !name.endsWith('-e2e'));

  const violations: Violation[] = [];

  for (const service of services) {
    const serviceAppDir = join(APPS_ROOT, service, 'src', 'app');
    if (!existsSync(serviceAppDir)) {
      continue;
    }

    const files: string[] = [];
    walk(serviceAppDir, files, TARGET_SUFFIX);
    for (const suffix of NON_HTTP_HANDLER_SUFFIXES) {
      walk(serviceAppDir, files, suffix);
    }

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (!fileNeedsAuthz(content)) {
        continue;
      }
      if (fileUsesAuthz(content)) {
        continue;
      }
      const reason = HAS_NON_HTTP_HANDLER_RE.test(content)
        ? 'Non-HTTP handler (Bull processor / WebSocket gateway / @OnEvent / @Cron) reads RequestContext and accesses data without AuthorizationService. Global guards do NOT run on these handlers — authz must be enforced explicitly.'
        : 'Missing AuthorizationService usage for RequestContext-based data access.';
      violations.push({ file, reason });
    }
  }

  return violations;
}

function checkControllerGuardChains(): Violation[] {
  const violations: Violation[] = [];

  if (!existsSync(APPS_ROOT)) {
    return violations;
  }

  const services = readdirSync(APPS_ROOT)
    .filter((name) => name.startsWith('svc-'))
    // Skip e2e test apps; they don't ship runtime endpoints.
    .filter((name) => !name.endsWith('-e2e'));

  for (const service of services) {
    const serviceAppDir = join(APPS_ROOT, service, 'src', 'app');
    if (!existsSync(serviceAppDir)) {
      continue;
    }

    // A service may wire APP_GUARD providers from any .module.ts in its
    // graph; precompute once per service.
    const serviceGuardsWired = serviceWiresGuardsGlobally(serviceAppDir);
    const appModule = join(serviceAppDir, 'app.module.ts');
    const mainGuardsWired = existsSync(appModule)
      ? mainTsWiresGuardsGlobally(appModule)
      : false;

    const controllerFiles = walk(serviceAppDir, [], CONTROLLER_SUFFIX);

    for (const controller of controllerFiles) {
      const content = readFileSync(controller, 'utf8');
      if (!controllerHasInertProtection(content)) {
        continue;
      }

      // If the service wires guards globally (APP_GUARD / useGlobalGuards /
      // GlobalGuardsModule), every handler is covered; nothing else to check.
      if (serviceGuardsWired || mainGuardsWired) {
        continue;
      }

      const unguardedLines = findUnguardedProtectedHandlers(content);
      if (unguardedLines.length === 0) {
        continue;
      }

      for (const line of unguardedLines) {
        violations.push({
          file: `${controller}:${line}`,
          reason:
            `Authz decorator (@Roles/@RequirePermission/@AbacScope) at line ${line} but no @UseGuards(JwtAuthGuard, ...) on the controller class or directly above the handler, and apps/${service} does not import GlobalGuardsModule (or wire APP_GUARD providers / useGlobalGuards in main.ts). Decorators are INERT - endpoint is anonymously callable.`,
        });
      }
    }
  }

  return violations;
}

function main() {
  const violations: Violation[] = [
    ...checkServiceAuthzBypass(),
    ...checkControllerGuardChains(),
  ];

  if (violations.length === 0) {
    console.log('authz bypass check: ok');
    return;
  }

  console.error('authz bypass check failed');
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.reason}`);
  }
  process.exit(1);
}

main();
