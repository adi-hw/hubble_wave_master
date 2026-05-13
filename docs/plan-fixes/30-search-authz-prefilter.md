# Plan Fix 30 — Search Authz Pre-Filter

**Status:** Complete (PR-3 — pgvector pre-filter landed)
**Owner:** adi-hw
**Effort:** 3 PRs (PR-1 DSL/compiler ✓, PR-2 Typesense emitter + indexer projection ✓, PR-3 vector pre-filter)
**Related canon clauses:** §9 (centralized authz), §11 (AVA), §28 (resolution model)
**Triggering audit:** F136 — search authz post-filter (pagination + facet leak)

## Context

The platform's vector + keyword search currently applies authorization as a post-filter: the search engine returns N hits, then `authzCheck` is evaluated per-hit to drop forbidden records. This design is broken at scale for four reasons:

1. **Pagination is wrong.** Page count is computed from the raw hit count before the post-filter runs. A user sees "page 1 of 5" but only 3 hits are visible — the other 7 on the page were silently filtered out.
2. **Facets leak.** Facet aggregations (counts, ranges) are computed from the full result set, so forbidden records inflate visible facet counts.
3. **Top-N degrades.** A search returning 10 hits per page may show 0 visible results if all 10 are forbidden for the active user. The user must page forward to find anything, and the UI gives no indication of why.
4. **Wasted work.** Computing vector similarity / BM25 scores for records the user can never see burns CPU and KV I/O for zero value.

The fix is to push authorization into the search engine as a pre-filter rather than a post-filter:

```
[§28 CollectionAccessRule evaluator]
  → [Filter AST]
  → engine-specific emitters
      ├─→ Typesense filter_by clause (PR-2)
      └─→ pgvector SQL WHERE clause (PR-3)
```

The compiler translates `CollectionAccessRule[]` for the active user into an engine-neutral filter AST. Per-engine emitters (in subsequent PRs) render the AST into Typesense `filter_by` syntax and pgvector SQL. The AST is the contract; neither emitter contains authorization logic.

## PR sequence

### PR-1 (this PR): DSL + compiler primitives

Lands the engine-neutral filter AST type definitions and the compiler that maps §28 collection access rules to that AST. No engine wiring.

**Algorithm:**
- Filters all collection rules to those that match the user's identity (userId, roleId, groupId, or public/no-principal rules).
- Groups matching rules by collection.
- For each collection, applies §28.3 record-decision precedence:
  - Level 1: an unconditional deny rule (no row-condition, canRead=true, effect='deny') excludes the collection from the AST entirely — §28.4 deny-wins applies.
  - Level 2: allow rules with `canRead=true` contribute their row-conditions. Multiple allows UNION (§28.4 rule 5).
  - Level 3 (default deny): no matching allow → collection not included.
- Row-condition translation:
  - No condition → `in_collection` (unconditional access to that collection's records).
  - `{ operator: 'equals', value: '@currentUser' }` → `attribute_match` (deferred ABAC substitution).
  - `{ operator: 'equals', value: '@currentUser.xxx' }` → `attribute_match` with `userAttribute: 'xxx'`.
  - `{ operator: 'equals', value: <literal> }` → `eq`.
  - `{ operator: 'in', value: [...] }` → `in`.
  - Unsupported operator (gt, lt, starts_with, etc.) → degrades to `in_collection` (broader); post-filter still applies for that collection.
- Per-collection ASTs are OR-combined (user can see records from any allowed collection).

**`attribute_match` nodes** defer user-attribute substitution to the emitter so the AST is user-agnostic and cacheable at the role/collection level.

**Files:**
- New: `libs/search-authz/src/lib/ast.ts` — FilterAst discriminated union type
- New: `libs/search-authz/src/lib/compiler.ts` — compileSearchAuthz() function
- New: `libs/search-authz/src/lib/compiler.spec.ts` — 15 test assertions
- New: `libs/search-authz/src/index.ts` — public barrel
- New: `libs/search-authz/project.json` — Nx project config
- New: `libs/search-authz/tsconfig.json`, `tsconfig.lib.json`, `tsconfig.spec.json`, `jest.config.ts`
- Updated: `tsconfig.base.json` — `@hubblewave/search-authz` path mapping

**Out of scope:** Typesense wiring, vector pre-filter, indexer projection updater. Those land in PR-2 and PR-3.

### PR-2 (complete): Typesense filter_by + indexer projection updater

**Files:**
- New: `libs/search-authz/src/lib/typesense-emitter.ts` — `emitTypesenseFilterBy(ast, attrs)` translates FilterAst → Typesense filter_by syntax.
- New: `libs/search-authz/src/lib/typesense-emitter.spec.ts` — 29 assertions covering every node kind, edge cases, and ABAC substitution.
- New: `libs/search-authz/src/lib/acl-projection.ts` — `AclProjection` type + `extractRequiredAttributes(ast)` walker.
- Updated: `libs/search-authz/src/index.ts` — extended barrel exports.
- Updated: `apps/api/src/app/ava/search/search.types.ts` — `SearchSourceConfig` extended with `collection_id` + `acl_attributes` fields.
- Updated: `apps/api/src/app/ava/search/search-indexing.service.ts` — `buildAclFields()` attaches `_collection_id` + `_<attr>` fields to every indexed document.
- Updated: `apps/api/src/app/ava/search/search-query.service.ts` — pre-filter wired; `trimUnauthorized` post-filter loop removed; pagination counts are now exact.
- Updated: `apps/api/src/app/ava/search/search-query.service.spec.ts` — 9 pre-filter integration assertions replace the F136-minimal post-filter suite.
- Updated: `apps/api/src/app/ava/search/search.module.ts` — `CollectionAccessRule` added to TypeOrmModule.forFeature.
- Updated: `tools/dead-code-allowlist.json` — removed `libs/search-authz` orphan-lib entry (now has an importer).

**Algorithm:** `buildAuthzFilterBy(context, sources)` (1) resolves `collection_id` from each source's config, (2) fetches all active `CollectionAccessRule` rows for those collections, (3) maps them to `CollectionAccessRuleData`, (4) calls `compileSearchAuthz()` to produce a FilterAst, (5) calls `emitTypesenseFilterBy(ast, userAttrs)` to produce the filter string, (6) AND-combines with any existing request filters before passing to the Typesense client. Admin users short-circuit to an empty filter (matching §28.6 posture).

**Post-filter removal:** `trimUnauthorized()` deleted. `pagination_approximate` is always `false` in lexical mode (pre-filter guarantees the engine only returns authorized records). Facet counts come from the engine directly in lexical mode (engine-accurate post-filter, not page-local recompute).

**ABAC attributes:** `SearchSourceConfig.acl_attributes` lists which record fields to denormalize as `_<field>` in the Typesense document. `extractRequiredAttributes(ast)` derives the required set from the compiled AST for documentation / tooling use.

**Scope note:** pgvector / semantic pre-filter lands in PR-3. Semantic mode still runs without authz pre-filter at this stage (the lexical pre-filter handles the hybrid/lexical path entirely).

### PR-3 (complete): pgvector pre-filter SQL

**Files:**
- New: `libs/search-authz/src/lib/pgvector-emitter.ts` — `emitPgvectorWhere(ast, attrs, startParamIndex?)` translates FilterAst → parameterized SQL WHERE clause. All user-attribute values go through bind parameters (`$N`) — never interpolated into the SQL string.
- New: `libs/search-authz/src/lib/pgvector-emitter.spec.ts` — 33 assertions covering every node kind, parameter ordering, startParamIndex offset, and SQL injection guard (tests 17–19 explicitly verify malicious values never appear in the clause string).
- Updated: `libs/search-authz/src/index.ts` — exports `emitPgvectorWhere` and `PgvectorWhereResult`.
- Updated: `apps/api/src/app/ava/search/search-embedding.service.ts` — `search()` accepts optional `authzAst` + `authzAttrs` parameters; `emitPgvectorWhere` is called to build the WHERE clause injected before ANN ranking. `upsertRecordEmbeddings()` accepts optional `acl` object to write `_collection_id` and `_attribute_*` columns at index time.
- Updated: `apps/api/src/app/ava/search/search-query.service.ts` — `buildAuthzFilterBy()` refactored to `buildAuthzAst()` which returns `{ ast, filterBy, userAttrs }`. The same FilterAst is now passed to both the Typesense emitter (lexical path) and pgvector emitter (semantic path) — compiled once per request.
- New: `migrations/instance/1931000000000-search-embeddings-acl-columns.ts` — adds `_collection_id uuid`, `_attribute_region text`, `_attribute_department_id uuid`, `_attribute_site_id uuid` columns to `search_embeddings`. All indexes use `CREATE INDEX CONCURRENTLY`. Migration runs outside transaction (`transaction = false`).
- Updated: `tools/authz-bypass-check.ts` — extended `AUTHZ_USAGE_PATTERNS` to recognize `emitPgvectorWhere(`, `emitTypesenseFilterBy(`, and `compileSearchAuthz(` as authz integration points (these ARE the §28 enforcement path for the search pipeline).

**Algorithm:** `buildAuthzAst(context, sources)` compiles the §28 FilterAst once from `CollectionAccessRule[]`. The same AST is passed to:
- `emitTypesenseFilterBy(ast, userAttrs)` → Typesense `filter_by` string (lexical/hybrid path, PR-2).
- `emitPgvectorWhere(ast, userAttrs, 2)` inside `SearchEmbeddingService.search()` → SQL WHERE fragment with `$N` bind params injected into the cosine-similarity query (semantic path, this PR).

**Security:** `emitPgvectorWhere` never interpolates attribute values as SQL literals. Every `attribute_match`, `in_collection`, `eq`, and `in` node binds its values via PostgreSQL parameterized query placeholders. The self-test includes three explicit SQL injection guard assertions (tests 17–19).

**Schema note:** The `_attribute_*` columns added in this migration are the initial set derived from current ACL rule vocabulary (`region`, `department_id`, `site_id`). Additional columns can be added in follow-up migrations as new ABAC attributes are introduced to `CollectionAccessRule` conditions.

## Acceptance

- `libs/search-authz/` builds clean (`tsc --noEmit` on both lib and spec).
- 15 compiler test assertions pass (all green).
- AST is engine-neutral — no Typesense / pgvector / SQL / HTTP imports anywhere in the lib.
- ABAC predicates compile to `attribute_match` (deferred resolution to emitter layer).
- Public (no-principal) allow rules match any user.
- §28.3 level-1 deny rules exclude collections even when a co-matching allow rule exists.
- Unsupported row-condition operators degrade to `in_collection` (fail-broader, documented).

## Out of scope (PR-1)

- Engine emitters (PR-2, PR-3)
- Field-level pre-filter (orthogonal — post-fetch masking pipeline still applies for PropertyAccessRules)
- Compiled effective permission graphs (Cedar/OPA-style materialization) — canon §28.8 explicitly deferred
- ACL re-projection on index update — PR-2's indexer projection updater
- PropertyAccessRule compilation — field visibility is post-search masking, not record pre-filter
