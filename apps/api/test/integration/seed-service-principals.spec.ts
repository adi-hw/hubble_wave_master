/**
 * Canon §29.7 / W2 follow-up — service-token seed vocabulary check.
 *
 * The `permission-registry-sync-check` scanner walks decorator call
 * sites (`@RequirePermission`, `@RequireServiceScope`, JSX
 * `<RequirePermission>`) but does NOT parse SQL string literals in
 * migrations. Service-token scopes are materialized into the
 * `service_principals.allowed_scopes` column via the seed migration
 * `migrations/instance/1000000000004-seed-service-principals.ts`;
 * without a spec like this, the seed could drift away from
 * `PERMISSION_REGISTRY` silently (and it did — the original seed
 * shipped with the retired `work_order:read` / `work_order:write` /
 * `audit:write` triple, which never existed in the registry).
 *
 * The spec parses the seed file as text, extracts every quoted scope
 * value from the `ARRAY[...]` literal, and asserts each is in the
 * canonical registry. The spec lives in apps/api/test/integration so
 * jest discovers it via the normal scan (the migrations directory is
 * excluded from jest's testPathPatterns).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PERMISSION_REGISTRY } from '@hubblewave/permission-registry';

describe('seed-service-principals — allowed_scopes vocabulary (canon §29.7)', () => {
  const seedPath = join(
    __dirname,
    '../../../../migrations/instance/1000000000004-seed-service-principals.ts',
  );
  const src = readFileSync(seedPath, 'utf8');

  function extractTokensInFirstArrayLiteral(text: string): string[] {
    const arrayMatch = /ARRAY\[([^\]]*)\]/m.exec(text);
    if (!arrayMatch) {
      throw new Error('Could not find ARRAY[...] literal in seed migration');
    }
    const inner = arrayMatch[1];
    const tokens: string[] = [];
    const tokenRe = /'([^']+)'/g;
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(inner)) !== null) {
      tokens.push(m[1]);
    }
    return tokens;
  }

  it("every scope in the seed's allowed_scopes array is a code in PERMISSION_REGISTRY", () => {
    // The seed has two ARRAY[...] literals: `allowed_audiences` first,
    // then `allowed_scopes`. Slice the source after the audiences
    // ARRAY to land the helper on the scopes ARRAY.
    const audienceMarker = /ARRAY\[[^\]]*'svc-api'[^\]]*\]/;
    const tail = src.split(audienceMarker)[1];
    expect(tail).toBeDefined();

    const scopes = extractTokensInFirstArrayLiteral(tail);
    expect(scopes.length).toBeGreaterThan(0);

    const registeredCodes = new Set(PERMISSION_REGISTRY.map((e) => e.code));
    const unregistered = scopes.filter((s) => !registeredCodes.has(s));

    expect(unregistered).toEqual([]);
  });

  it("seed audience list is exactly ['svc-api']", () => {
    // Pin the audience list so a future drift toward a longer audience
    // array (which would imply additional cross-process call surfaces
    // that canon §29.7 says must be added explicitly via migration)
    // gets caught at PR time.
    const audiences = extractTokensInFirstArrayLiteral(src);
    expect(audiences).toEqual(['svc-api']);
  });
});
