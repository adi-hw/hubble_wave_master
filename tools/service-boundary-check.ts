import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve, dirname, sep } from 'path';

/**
 * Static-analysis check for canon §3 (Platform, not application) and the
 * service-responsibility map in PART 2 §C of the architectural plan.
 *
 * Scans every TypeScript source file under apps/svc-XYZ/src/ and rejects any
 * import that crosses a service boundary directly. Cross-service collaboration
 * must go through libs/ (the shared surface). Same-service imports,
 * libs/ imports, and third-party packages are always allowed.
 *
 * This enforces Fix 12 of the remediation plan: a service importing from
 * another service's source today silently passes every other gate, because no
 * authz/audit/security check inspects import topology.
 */

type Violation = {
  file: string;
  line: number;
  importPath: string;
  fromService: string;
  toService: string;
};

const ROOT = process.cwd();
const APPS_DIR = join(ROOT, 'apps');
const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  'tmp',
  '.nx',
  '.git',
  '__tests__',
]);

/**
 * Cross-service imports that have been accepted as deferred work pending a
 * structural refactor (Plan Fix 24 — earn the service boundaries). Each entry
 * lists the importing file, the import path that crosses a boundary, and the
 * follow-up wave. New entries require explicit founder/architect approval.
 */
const KNOWN_VIOLATIONS: Array<{
  file: string;
  importPath: string;
  rationale: string;
  followUp: string;
}> = [];

/**
 * Entity ownership map. Each entity is owned by exactly one service per the
 * service-responsibility map (zippy-creek §C). Importing a TypeORM entity
 * inside another service's source tree gives that service the ability to
 * read or mutate the entity, which violates ownership even if no actual
 * write happens at that line — the import is the channel.
 *
 * Entries here are enforced at CI time: a non-owner service that imports
 * one of these entities from `@hubblewave/instance-db` fails the build.
 * The owner service may import the entity freely; libs/ may import freely
 * (they are the shared surface).
 *
 * Plan Fix 1 establishes the first two entries. Adding more entries
 * requires the same level of architectural review as canon amendments —
 * it is the lever by which "svc-automation owns automation" is upgraded
 * from a documented intention to a CI-enforced contract.
 */
const ENTITY_OWNERSHIP: Record<string, string> = {
  AutomationRule: 'svc-automation',
  AutomationRuleRevision: 'svc-automation',
  AutomationExecutionLog: 'svc-automation',
  ScheduledJob: 'svc-automation',
};

/**
 * Physical table name for each owned entity. Used by the
 * detectEntityWriteBypass check (W0 task 5 / F056). The import-topology
 * rule above blocks the typed pathway (Repository<EntityName>); this map
 * powers the secondary check for the untyped string-based bypasses
 * `.getRepository('automation_rules')` and raw SQL `UPDATE
 * automation_rules SET ...`. Both routes can write to an owned entity
 * without ever importing the symbol.
 *
 * MUST stay in lockstep with @Entity('table_name') declarations in
 * libs/instance-db/src/lib/entities/. Verified manually 2026-05-09:
 *   - automation_rules            → AutomationRule
 *   - automation_rule_revisions   → AutomationRuleRevision
 *   - automation_execution_logs   → AutomationExecutionLog
 *   - scheduled_jobs              → ScheduledJob
 */
const ENTITY_TABLES: Record<string, string> = {
  AutomationRule: 'automation_rules',
  AutomationRuleRevision: 'automation_rule_revisions',
  AutomationExecutionLog: 'automation_execution_logs',
  ScheduledJob: 'scheduled_jobs',
};

/**
 * Allowlist for write-bypass false positives — e.g. a string `'automation_rules'`
 * appearing as a table-name CONSTANT in a non-write context (a migration
 * helper, a column-name registry, a shared metadata config). Each entry
 * MUST cite a structural reason. New entries require architect approval
 * (same bar as KNOWN_ENTITY_VIOLATIONS).
 */
const KNOWN_WRITE_BYPASS_ALLOWLIST: ReadonlyArray<{
  file: string;
  table: string;
  rationale: string;
}> = [];

type EntityViolation = {
  file: string;
  line: number;
  entity: string;
  expectedOwner: string;
  actualImporter: string;
};

/**
 * Allowlist for entity-ownership crossings that are legitimate
 * design-time access. Each entry must document the reason. Runtime
 * crossings (sync triggers, post-commit automation execution) MUST
 * NOT appear here — those go through HTTP / outbox.
 *
 * The zippy-creek critique acknowledged that svc-metadata has
 * cross-cutting design-time responsibilities: publish-impact
 * analysis, reference scanning before property delete, pack
 * install/export, change-package authoring. Each of these
 * legitimately reads or writes AutomationRule at design time.
 *
 * New entries require explicit founder/architect approval and a
 * one-line rationale. The point of the allowlist is to make
 * crossings visible and reviewable, not to dilute the rule.
 */
const KNOWN_ENTITY_VIOLATIONS: Array<{
  file: string;
  entity: string;
  rationale: string;
}> = [
  {
    file: 'apps/svc-metadata/src/app/publish-impact/analyzers/automation-rule-impact.analyzer.ts',
    entity: 'AutomationRule',
    rationale: 'Design-time impact analysis. Reads automation rules to compute downstream effects of metadata changes.',
  },
  {
    file: 'apps/svc-metadata/src/app/publish-impact/publish-impact.module.ts',
    entity: 'AutomationRule',
    rationale: 'Module wiring for the impact analyzer above.',
  },
  {
    file: 'apps/svc-metadata/src/app/property/reference-scanner.service.ts',
    entity: 'AutomationRule',
    rationale: 'W2.A reference scanner. Reads automation rules to find references to a property before delete (canon §14).',
  },
  {
    file: 'apps/svc-metadata/src/app/property/reference-scanner.service.spec.ts',
    entity: 'AutomationRule',
    rationale: 'Test fixture for the reference scanner above.',
  },
  {
    file: 'apps/svc-metadata/src/app/packs/packs.service.ts',
    entity: 'AutomationRule',
    rationale: 'Pack install/export. Reads + writes automation rules as part of bundling and applying customer packs (zippy-creek Fix 8 — pack install is svc-metadata\'s design-time responsibility).',
  },
  {
    file: 'apps/svc-metadata/src/app/change-packages/change-package.service.ts',
    entity: 'AutomationRule',
    rationale: 'Change-package authoring. Reads automation rules to bundle them in a change package for export.',
  },
  {
    file: 'apps/svc-metadata/src/app/change-packages/change-package.service.spec.ts',
    entity: 'AutomationRule',
    rationale: 'Test fixture for the change-package service above.',
  },
];

function isKnownEntityViolation(file: string, entity: string): boolean {
  const rel = toPosix(file);
  return KNOWN_ENTITY_VIOLATIONS.some(
    (entry) => rel.endsWith(entry.file) && entry.entity === entity,
  );
}

const SERVICE_DIR_RE = /^svc-[a-z0-9-]+$/;

function isServiceDir(name: string): boolean {
  return SERVICE_DIR_RE.test(name);
}

function walk(dir: string, files: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry)) {
      continue;
    }
    const fullPath = join(dir, entry);
    let stats;
    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (
      (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) &&
      !fullPath.endsWith('.d.ts')
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

/**
 * Returns the service name (e.g. "svc-data") that owns this absolute file
 * path, or null if the file is not under an apps/svc-XYZ root.
 */
function serviceOf(absolutePath: string): string | null {
  const rel = toPosix(relative(APPS_DIR, absolutePath));
  if (rel.startsWith('..')) return null;
  const first = rel.split('/')[0];
  return isServiceDir(first) ? first : null;
}

/**
 * Extract every module specifier referenced from a TS source file along with
 * its line number. Covers static imports, dynamic re-exports, `import type`,
 * `import(...)` expressions, and `require(...)`.
 */
function extractImports(content: string): Array<{ spec: string; line: number }> {
  const results: Array<{ spec: string; line: number }> = [];
  const lines = content.split(/\r?\n/);
  // Patterns deliberately permissive — false positives are downgraded to
  // "unknown specifier" in classify(), not raised as violations.
  const patterns: RegExp[] = [
    /\bimport\s+(?:type\s+)?[^'"`;]*?\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?[^'"`;]*?\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const offset = match.index;
      // Compute 1-based line number from offset.
      let line = 1;
      let count = 0;
      for (const l of lines) {
        if (count + l.length + 1 > offset) break;
        count += l.length + 1;
        line++;
      }
      results.push({ spec: match[1], line });
    }
  }
  return results;
}

/**
 * Resolves an import specifier to a destination service if (and only if) it
 * lands inside another apps/svc-XYZ source tree. Returns null when the import
 * is allowed (libs, third-party, same service, untracked).
 */
function resolveCrossServiceTarget(
  importerFile: string,
  spec: string,
  fromService: string,
): string | null {
  // Third-party (bare specifier without a leading "." or "/") is always allowed
  // unless it explicitly addresses an apps path through a workspace alias.
  // None of the configured tsconfig.base.json paths point at apps/, but defend
  // against future aliases that might.
  if (
    !spec.startsWith('.') &&
    !spec.startsWith('/') &&
    !spec.startsWith('apps/') &&
    !spec.startsWith('@hubblewave/svc-')
  ) {
    return null;
  }

  // Workspace-relative absolute (e.g. "apps/svc-other/src/...").
  if (spec.startsWith('apps/')) {
    const segments = spec.split('/');
    if (segments.length >= 2 && isServiceDir(segments[1])) {
      const target = segments[1];
      return target === fromService ? null : target;
    }
    return null;
  }

  // Hypothetical cross-service alias.
  if (spec.startsWith('@hubblewave/svc-')) {
    const target = spec.replace('@hubblewave/', '').split('/')[0];
    if (isServiceDir(target)) {
      return target === fromService ? null : target;
    }
    return null;
  }

  // Relative path: resolve against the importing file's directory and check
  // whether the absolute target lives under a different apps/svc-* root.
  if (spec.startsWith('.') || spec.startsWith('/')) {
    const resolved = resolve(dirname(importerFile), spec);
    const targetService = serviceOf(resolved);
    if (targetService && targetService !== fromService) {
      return targetService;
    }
    return null;
  }

  return null;
}

function isKnownViolation(file: string, importPath: string): boolean {
  const rel = toPosix(relative(ROOT, file));
  return KNOWN_VIOLATIONS.some(
    (entry) => rel.endsWith(entry.file) && entry.importPath === importPath,
  );
}

function detectViolations(): Violation[] {
  const violations: Violation[] = [];
  const serviceDirs = (() => {
    try {
      return readdirSync(APPS_DIR).filter((name) => {
        if (!isServiceDir(name)) return false;
        const srcDir = join(APPS_DIR, name, 'src');
        try {
          return statSync(srcDir).isDirectory();
        } catch {
          return false;
        }
      });
    } catch {
      return [];
    }
  })();

  for (const service of serviceDirs) {
    const srcDir = join(APPS_DIR, service, 'src');
    const files = walk(srcDir);
    for (const file of files) {
      const fromService = serviceOf(file);
      if (!fromService) continue;
      let content: string;
      try {
        content = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const imports = extractImports(content);
      for (const { spec, line } of imports) {
        const toService = resolveCrossServiceTarget(file, spec, fromService);
        if (!toService) continue;
        if (isKnownViolation(file, spec)) continue;
        violations.push({
          file: toPosix(relative(ROOT, file)),
          line,
          importPath: spec,
          fromService,
          toService,
        });
      }
    }
  }
  return violations;
}

/**
 * Detects imports of owned entities from `@hubblewave/instance-db` by
 * services that are not the entity's owner. The check is import-graph
 * shaped: any import of the entity name in a non-owner service's source
 * tree fails CI, regardless of whether the importing line uses the
 * entity to read or write. Reads are flagged because canonical ownership
 * means no other service should know about the entity at all — they go
 * through the owner's HTTP / event surface.
 */
function detectEntityOwnershipViolations(): EntityViolation[] {
  const violations: EntityViolation[] = [];
  const ownedEntities = Object.keys(ENTITY_OWNERSHIP);
  if (ownedEntities.length === 0) return violations;

  const serviceDirs = (() => {
    try {
      return readdirSync(APPS_DIR).filter((name) => {
        if (!isServiceDir(name)) return false;
        const srcDir = join(APPS_DIR, name, 'src');
        try {
          return statSync(srcDir).isDirectory();
        } catch {
          return false;
        }
      });
    } catch {
      return [];
    }
  })();

  // Pattern: capture the named-import block from `@hubblewave/instance-db`.
  // Multiline support so the typical multi-line `import { ... }` block
  // matches as one specifier list.
  const importBlockRe =
    /\bimport\s+(?:type\s+)?\{([^}]*)\}\s*from\s+['"]@hubblewave\/instance-db['"]/g;

  for (const service of serviceDirs) {
    const srcDir = join(APPS_DIR, service, 'src');
    const files = walk(srcDir);
    for (const file of files) {
      const fromService = serviceOf(file);
      if (!fromService) continue;
      let content: string;
      try {
        content = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const lines = content.split(/\r?\n/);

      let blockMatch: RegExpExecArray | null;
      while ((blockMatch = importBlockRe.exec(content)) !== null) {
        const namedList = blockMatch[1];
        // Compute 1-based line number for the start of the import block.
        const offset = blockMatch.index;
        let line = 1;
        let count = 0;
        for (const l of lines) {
          if (count + l.length + 1 > offset) break;
          count += l.length + 1;
          line++;
        }
        // Each named binding is `Foo` or `Foo as Bar` — capture the source
        // name (left of `as`) since that is what binds to the entity.
        const names = namedList
          .split(',')
          .map((seg) => seg.trim())
          .filter(Boolean)
          .map((seg) => seg.split(/\s+as\s+/)[0].trim());
        for (const name of names) {
          const owner = ENTITY_OWNERSHIP[name];
          if (!owner) continue;
          if (owner === fromService) continue;
          const relFile = toPosix(relative(ROOT, file));
          if (isKnownEntityViolation(relFile, name)) continue;
          violations.push({
            file: relFile,
            line,
            entity: name,
            expectedOwner: owner,
            actualImporter: fromService,
          });
        }
      }
    }
  }
  return violations;
}

interface EntityWriteViolation {
  file: string;
  line: number;
  table: string;
  entity: string;
  expectedOwner: string;
  actualWriter: string;
  pattern: 'string-getRepository' | 'raw-sql-insert' | 'raw-sql-update' | 'raw-sql-delete';
}

function isAllowlistedWriteBypass(relFile: string, table: string): boolean {
  return KNOWN_WRITE_BYPASS_ALLOWLIST.some(
    (entry) => relFile.endsWith(entry.file) && entry.table === table,
  );
}

function lineNumberAt(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') line += 1;
  }
  return line;
}

/**
 * detectEntityWriteBypass — secondary check that backstops the
 * import-topology rule for two known bypass routes:
 *
 *   1. `.getRepository('automation_rules')` — TypeORM lets you fetch a
 *      repository by string table name with no entity import. The
 *      returned repository is typed as `Repository<ObjectLiteral>` so
 *      `.save({})` works without ever referencing AutomationRule.
 *
 *   2. Raw SQL via dataSource.query / queryRunner — `UPDATE
 *      automation_rules SET ...`, `INSERT INTO automation_rules ...`,
 *      `DELETE FROM automation_rules`. Bypasses every TypeORM check.
 *
 * Both patterns are detected by simple text matching against the
 * physical table name (`ENTITY_TABLES`). The allowlist
 * (`KNOWN_WRITE_BYPASS_ALLOWLIST`) handles legitimate occurrences such
 * as migration scripts that reference the table by name. New entries
 * require structural rationale.
 */
function detectEntityWriteBypass(): EntityWriteViolation[] {
  const violations: EntityWriteViolation[] = [];
  const ownedEntries = Object.entries(ENTITY_TABLES);
  if (ownedEntries.length === 0) return violations;

  // Build per-table regex patterns once.
  type PerTablePatterns = {
    entity: string;
    table: string;
    owner: string;
    getRepoRe: RegExp;
    insertRe: RegExp;
    updateRe: RegExp;
    deleteRe: RegExp;
  };
  const tablePatterns: PerTablePatterns[] = ownedEntries.map(([entity, table]) => ({
    entity,
    table,
    owner: ENTITY_OWNERSHIP[entity],
    // Match `getRepository('table_name')` or `getRepository("table_name")`.
    getRepoRe: new RegExp(`\\.getRepository\\s*\\(\\s*['"\`]${table}['"\`]`, 'g'),
    // Match raw SQL writes referencing the table. Word boundary required so
    // "automation_rules_extra" doesn't false-positive against "automation_rules".
    insertRe: new RegExp(`\\bINSERT\\s+INTO\\s+["']?${table}["']?\\b`, 'gi'),
    updateRe: new RegExp(`\\bUPDATE\\s+["']?${table}["']?\\b`, 'gi'),
    deleteRe: new RegExp(`\\bDELETE\\s+FROM\\s+["']?${table}["']?\\b`, 'gi'),
  }));

  const serviceDirs = (() => {
    try {
      return readdirSync(APPS_DIR).filter((name) => {
        if (!isServiceDir(name)) return false;
        const srcDir = join(APPS_DIR, name, 'src');
        try {
          return statSync(srcDir).isDirectory();
        } catch {
          return false;
        }
      });
    } catch {
      return [];
    }
  })();

  for (const service of serviceDirs) {
    const srcDir = join(APPS_DIR, service, 'src');
    const files = walk(srcDir);
    for (const file of files) {
      const fromService = serviceOf(file);
      if (!fromService) continue;

      let content: string;
      try {
        content = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const relFile = toPosix(relative(ROOT, file));

      for (const tp of tablePatterns) {
        if (tp.owner === fromService) continue; // Owner can write freely.
        if (isAllowlistedWriteBypass(relFile, tp.table)) continue;

        // Reset regex lastIndex (g-flag patterns retain state).
        tp.getRepoRe.lastIndex = 0;
        tp.insertRe.lastIndex = 0;
        tp.updateRe.lastIndex = 0;
        tp.deleteRe.lastIndex = 0;

        const checks: Array<{ re: RegExp; pattern: EntityWriteViolation['pattern'] }> = [
          { re: tp.getRepoRe, pattern: 'string-getRepository' },
          { re: tp.insertRe, pattern: 'raw-sql-insert' },
          { re: tp.updateRe, pattern: 'raw-sql-update' },
          { re: tp.deleteRe, pattern: 'raw-sql-delete' },
        ];

        for (const { re, pattern } of checks) {
          let m: RegExpExecArray | null;
          while ((m = re.exec(content)) !== null) {
            violations.push({
              file: relFile,
              line: lineNumberAt(content, m.index),
              table: tp.table,
              entity: tp.entity,
              expectedOwner: tp.owner,
              actualWriter: fromService,
              pattern,
            });
          }
        }
      }
    }
  }

  return violations;
}

function main() {
  const violations = detectViolations();
  const entityViolations = detectEntityOwnershipViolations();
  const writeBypassViolations = detectEntityWriteBypass();

  if (
    violations.length === 0 &&
    entityViolations.length === 0 &&
    writeBypassViolations.length === 0
  ) {
    console.log('service boundary check: ok');
    if (KNOWN_VIOLATIONS.length > 0) {
      console.log(`  (${KNOWN_VIOLATIONS.length} allowlisted cross-service import(s) tracked):`);
      for (const entry of KNOWN_VIOLATIONS) {
        console.log(`    - ${entry.file} -> ${entry.importPath}  [${entry.followUp}]`);
      }
    }
    const ownedCount = Object.keys(ENTITY_OWNERSHIP).length;
    if (ownedCount > 0) {
      console.log(`  (${ownedCount} entity ownership rule(s) enforced):`);
      for (const [entity, owner] of Object.entries(ENTITY_OWNERSHIP)) {
        console.log(`    - ${entity} owned by ${owner}`);
      }
    }
    const writeRuleCount = Object.keys(ENTITY_TABLES).length;
    if (writeRuleCount > 0) {
      console.log(`  (${writeRuleCount} entity write-bypass rule(s) enforced via table-name):`);
      for (const [entity, table] of Object.entries(ENTITY_TABLES)) {
        console.log(`    - table ${table} writable only by ${ENTITY_OWNERSHIP[entity]} (${entity})`);
      }
    }
    if (KNOWN_ENTITY_VIOLATIONS.length > 0) {
      console.log(`  (${KNOWN_ENTITY_VIOLATIONS.length} allowlisted entity crossing(s) tracked):`);
      for (const entry of KNOWN_ENTITY_VIOLATIONS) {
        console.log(`    - ${entry.file} reads ${entry.entity}`);
      }
    }
    if (KNOWN_WRITE_BYPASS_ALLOWLIST.length > 0) {
      console.log(`  (${KNOWN_WRITE_BYPASS_ALLOWLIST.length} allowlisted write-bypass(es) tracked):`);
      for (const entry of KNOWN_WRITE_BYPASS_ALLOWLIST) {
        console.log(`    - ${entry.file} touches ${entry.table}`);
      }
    }
    return;
  }

  if (violations.length > 0) {
    console.error(`service boundary check: FAILED (${violations.length} violation(s))`);
    console.error('Cross-service source imports are forbidden. Services must');
    console.error('collaborate through libs/* (the shared surface), HTTP RPC,');
    console.error('or the outbox event bus — not by reaching into another');
    console.error("service's source tree directly. (Plan Fix 12 / canon §3.)");
    console.error('');
    for (const v of violations) {
      console.error(
        `  ${v.file}:${v.line} - ${v.fromService} imports from ${v.toService}: ${v.importPath}`,
      );
    }
  }

  if (entityViolations.length > 0) {
    if (violations.length > 0) console.error('');
    console.error(
      `entity ownership check: FAILED (${entityViolations.length} violation(s))`,
    );
    console.error('Domain entities are owned by a single service per the');
    console.error('service-responsibility map. Other services must reach the');
    console.error("owner via HTTP RPC or the outbox event bus, not by importing");
    console.error("the entity directly from @hubblewave/instance-db.");
    console.error('');
    for (const v of entityViolations) {
      console.error(
        `  ${v.file}:${v.line} - ${v.actualImporter} imports ${v.entity} (owned by ${v.expectedOwner})`,
      );
    }
  }

  if (writeBypassViolations.length > 0) {
    if (violations.length > 0 || entityViolations.length > 0) console.error('');
    console.error(
      `entity write-bypass check: FAILED (${writeBypassViolations.length} violation(s))`,
    );
    console.error('Owned entities can be written via two non-import routes:');
    console.error('  - getRepository(\'<table>\') — string-based untyped access');
    console.error('  - raw SQL UPDATE/INSERT/DELETE referencing the table');
    console.error('Both bypass the import-topology rule. Either route the');
    console.error("write through the owner service's HTTP API or move the");
    console.error('writer into the owner. (W0 task 5 / F056.)');
    console.error('');
    for (const v of writeBypassViolations) {
      console.error(
        `  ${v.file}:${v.line} - ${v.actualWriter} writes ${v.entity} via ${v.pattern} on table '${v.table}' (owned by ${v.expectedOwner})`,
      );
    }
  }

  process.exit(1);
}

main();
