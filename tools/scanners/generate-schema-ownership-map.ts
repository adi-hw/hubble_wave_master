#!/usr/bin/env tsx
/**
 * Generates docs/architecture/schema-ownership-map.md from the entity manifest
 * and cross-domain allowlist. Output:
 *   - schema → owning domain (per plane)
 *   - tables per schema
 *   - public exceptions
 *   - allowlisted cross-domain relations
 *
 * Manifest shape (W2 follow-up round 3): per-plane structure with
 * `instance` + `controlPlane` top-level sections. Backward-compat with
 * the pre-round-3 flat shape preserved by the loader below.
 *
 * Regenerated whenever the manifest or allowlist changes; committed alongside.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

interface PerPlaneManifest {
  _version?: number;
  $comment?: string;
  instance?: { [schema: string]: string[] };
  controlPlane?: { [schema: string]: string[] };
}

interface PlaneSection { [schema: string]: string[] }

function loadManifestSections(path: string): { instance: PlaneSection; controlPlane: PlaneSection } {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as PerPlaneManifest | Record<string, unknown>;
  if (raw && typeof raw === 'object' && 'instance' in raw && raw.instance) {
    return {
      instance: (raw.instance as PlaneSection) ?? {},
      controlPlane: ((raw as PerPlaneManifest).controlPlane as PlaneSection) ?? {},
    };
  }
  // Legacy flat shape — strip metadata keys + treat as instance.
  const flat: PlaneSection = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v)) flat[k] = v as string[];
  }
  return { instance: flat, controlPlane: {} };
}

const { instance, controlPlane } = loadManifestSections('tools/scanners/entity-schema-manifest.json');
const allowlist = JSON.parse(readFileSync('tools/scanners/cross-domain-allowlist.json', 'utf8'));

const out = ['# Schema Ownership Map',
  '',
  `_Generated_ from \`tools/scanners/entity-schema-manifest.json\` + \`tools/scanners/cross-domain-allowlist.json\`. **Do not edit by hand.** Regenerate with \`npx tsx tools/scanners/generate-schema-ownership-map.ts\`.`,
  '',
  '## Instance plane — Domain schemas',
  '',
  '`apps/api` reads from the customer-instance DB. Each domain has its own schema (canon §17 modular monolith).',
  ''];

for (const [schema, tables] of Object.entries(instance)) {
  if (schema === 'public') continue;
  out.push(`### \`${schema}\``);
  out.push('');
  for (const t of [...tables].sort()) out.push(`- \`${schema}.${t}\``);
  out.push('');
}

out.push('## Instance plane — Public-schema exceptions');
out.push('');
out.push('Tables intentionally kept in `public` on the instance DB (cross-domain shared or instance-wide singleton):');
out.push('');
for (const t of (instance.public ?? []).slice().sort()) out.push(`- \`public.${t}\``);
out.push('');

out.push('## Control plane — Schemas');
out.push('');
out.push('`apps/control-plane` reads from a separate DB (canon §18 — traditional multi-tenant admin app, not subject to the instance schema split). All tables live in `public`.');
out.push('');
for (const [schema, tables] of Object.entries(controlPlane)) {
  out.push(`### \`controlPlane.${schema}\``);
  out.push('');
  for (const t of [...tables].sort()) out.push(`- \`${schema}.${t}\``);
  out.push('');
}

out.push('## Allowlisted cross-domain relations');
out.push('');
if (!allowlist.entries.length) {
  out.push('_(none)_');
} else {
  out.push('| From | To | Rationale | Added by | Added at |');
  out.push('|---|---|---|---|---|');
  for (const e of allowlist.entries) {
    out.push(`| \`${e.from}\` | \`${e.to}\` | ${e.rationale} | ${e.addedBy} | ${e.addedAt} |`);
  }
}
out.push('');

mkdirSync('docs/architecture', { recursive: true });
writeFileSync('docs/architecture/schema-ownership-map.md', out.join('\n'));
console.log('Wrote docs/architecture/schema-ownership-map.md');
