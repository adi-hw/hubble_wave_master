#!/usr/bin/env tsx
/**
 * Generates docs/architecture/schema-ownership-map.md from the entity manifest
 * and cross-domain allowlist. Output:
 *   - schema → owning domain
 *   - tables per schema
 *   - public exceptions
 *   - allowlisted cross-domain relations
 *
 * Regenerated whenever the manifest or allowlist changes; committed alongside.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const manifest = JSON.parse(readFileSync('tools/scanners/entity-schema-manifest.json', 'utf8'));
const allowlist = JSON.parse(readFileSync('tools/scanners/cross-domain-allowlist.json', 'utf8'));

const out = ['# Schema Ownership Map',
  '',
  `_Generated_ from \`tools/scanners/entity-schema-manifest.json\` + \`tools/scanners/cross-domain-allowlist.json\`. **Do not edit by hand.** Regenerate with \`npx tsx tools/scanners/generate-schema-ownership-map.ts\`.`,
  '',
  '## Domain schemas',
  ''];

for (const [schema, tables] of Object.entries(manifest)) {
  if (schema === 'public') continue;
  out.push(`### \`${schema}\``);
  out.push('');
  for (const t of (tables as string[]).sort()) out.push(`- \`${schema}.${t}\``);
  out.push('');
}

out.push('## Public-schema exceptions');
out.push('');
out.push('Tables intentionally kept in `public` (cross-domain shared or instance-wide singleton):');
out.push('');
for (const t of (manifest.public ?? []).sort()) out.push(`- \`public.${t}\``);
out.push('');

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
