#!/usr/bin/env tsx
/**
 * abac-coverage-check
 *
 * Fails CI when a controller is opted in to @UseGuards(AbacGuard) but one or
 * more of its HTTP handlers lacks a valid ABAC annotation.
 *
 * AbacGuard is opt-in (not global).  The contract is: if you opt in at the
 * class level, every handler in that class must carry one of the recognised
 * ABAC annotations.  Unannotated handlers are a coverage gap that causes
 * runtime failures or silent access-control holes when AbacGuard enforces.
 *
 * Exit code: 0 — no violations; 1 — violations found (fails CI).
 *
 * Heuristic limitations (intentional — regex for scanner speed):
 * - The AbacGuard usage check scans the full file; a @UseGuards(AbacGuard)
 *   anywhere in the file marks the class as opted-in (covers both class-level
 *   and controller-level application).
 * - Annotation detection scans the 8 lines above the HTTP decorator.  A
 *   handler with an annotation more than 8 lines above will appear unannotated
 *   (false positive).  The 8-line window covers all known handler shapes in
 *   this codebase.
 * - Method name extraction uses a simple regex; unusual decorator stacking or
 *   spacing may show the method as "<unknown>".
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Decorators that satisfy the ABAC annotation requirement.
const ABAC_ANNOTATIONS = ['@AbacResource', '@SkipAbac', '@Public', '@AuthenticatedOnly'];

// NestJS HTTP method decorators that identify a handler boundary.
const HTTP_DECORATORS = ['@Get', '@Post', '@Put', '@Patch', '@Delete'];

interface ParsedArgs {
  root: string;
  ci: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  let root = 'apps/api/src';
  let ci = false;
  for (const a of argv) {
    if (a.startsWith('--root=')) root = a.slice('--root='.length);
    else if (a === '--ci') ci = true;
  }
  return { root, ci };
}

function findControllers(root: string): string[] {
  const out: string[] = [];
  function walk(d: string) {
    let entries: string[] = [];
    try { entries = readdirSync(d); } catch { return; }
    for (const e of entries) {
      const full = join(d, e);
      let s; try { s = statSync(full); } catch { continue; }
      if (s.isDirectory()) {
        if (e === 'node_modules' || e === 'dist' || e === '.git') continue;
        walk(full);
      } else if (e.endsWith('.controller.ts')) {
        out.push(full);
      }
    }
  }
  walk(root);
  return out;
}

function classUsesAbac(src: string): boolean {
  return /@UseGuards\([^)]*\bAbacGuard\b/.test(src);
}

interface HandlerResult {
  method: string;
  line: number;
  annotated: boolean;
}

function findHandlers(src: string): HandlerResult[] {
  const lines = src.split('\n');
  const out: HandlerResult[] = [];
  for (let i = 0; i < lines.length; i++) {
    for (const dec of HTTP_DECORATORS) {
      if (lines[i].trim().startsWith(dec)) {
        let annotated = false;
        for (let j = Math.max(0, i - 8); j < i; j++) {
          if (ABAC_ANNOTATIONS.some((a) => lines[j].includes(a))) {
            annotated = true;
            break;
          }
        }
        const methodLine = lines.slice(i + 1).find((l) => /^\s*(?:async\s+)?\w+\s*\(/.test(l));
        const m = methodLine ? /^\s*(?:async\s+)?(\w+)\s*\(/.exec(methodLine) : null;
        out.push({ method: m ? m[1] : '<unknown>', line: i + 1, annotated });
      }
    }
  }
  return out;
}

interface Violation {
  file: string;
  method: string;
  line: number;
}

function main(): void {
  const { root, ci } = parseArgs(process.argv.slice(2));
  const violations: Violation[] = [];

  for (const file of findControllers(root)) {
    const src = readFileSync(file, 'utf8');
    if (!classUsesAbac(src)) continue;
    for (const h of findHandlers(src)) {
      if (!h.annotated) {
        violations.push({ file, method: h.method, line: h.line });
      }
    }
  }

  if (ci) {
    console.log(JSON.stringify({ violations, total: violations.length }));
  } else if (violations.length > 0) {
    console.log(`AbacGuard coverage violations (${violations.length}):`);
    for (const v of violations) {
      console.log(`  ${v.file}:${v.line} — ${v.method}() lacks @AbacResource/@SkipAbac/@Public/@AuthenticatedOnly`);
    }
  } else {
    console.log('abac-coverage-check: 0 violations');
  }

  process.exit(violations.length > 0 ? 1 : 0);
}

main();
