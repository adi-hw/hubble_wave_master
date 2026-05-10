# W1 — Stop-the-Bleeding

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Eliminate every remote-code-execution, SQL-injection, SSRF, XSS, RCE-via-template, leaked-key, and crash-on-route-change finding. After W1 lands, the platform passes a baseline pen-test sweep.

**Architecture:** Sixteen tasks split across four streams. Each task closes one finding (or a tightly-coupled pair) with a regression test where the fix is testable in isolation. The W0 scanners catch most regressions for free; new W1-specific tests fill the rest.

**Tech Stack:** No new libs except where absolutely required (e.g., `xmlbuilder2` for safe SAML XML construction, F141). Approved-deps registry updated in the same commits that add deps.

**Findings addressed:** F011, F014, F027, F053, F073, F088, F089, F093, F111, F124, F125, F126, F127, F139, F141.

---

## Verification Pre-Pass (Mandatory First Step)

Per W0's lesson (~30% of audit findings were stale or wrong), every W1 task starts with `git grep` against the cited file:line to confirm the finding is still real. Reconcile against current code in this section before any work:

| ID | Cited Location | Verified 2026-05-09 | Notes |
|---|---|---|---|
| F011 | `apps/svc-identity/src/app/ldap/ldap.service.ts:54` | ✅ REAL | `filter.replace('{username}', username)` with no RFC 4515 escaping. |
| F014 | git history | ✅ REAL | gitleaks (W0 task 8) catches it on every PR; force-rewrite is tied to F111. |
| F027 | `libs/automation/src/lib/process-flow-engine.service.ts:89, 521` | TBD | Spot-check at task start. |
| F053 | `apps/svc-migrations/src/main.ts:51-53` | ✅ REAL | `?? 'hubblewave'` for DB_USER/PASSWORD/NAME. |
| F073 | `libs/ai/src/lib/vector-store.service.ts:198, 216-262` | TBD | Spot-check at task start. |
| F088 | `apps/web-client/src/routing/ProtectedRoute.tsx:22-24`, `PermissionGate.tsx:17-18` | ✅ REAL | Conditional hook calls confirmed. |
| F089 | `apps/web-control-plane/src/app/services/auth.ts:38-90` | ✅ REAL | localStorage.setItem(TOKEN_KEY/REFRESH_KEY/USER_KEY) at multiple sites. |
| F093 | `FormulaEditor.tsx:353`, `LivingDocsPage.tsx:257`, `AIReportsPage.tsx:350-363` | TBD | Three sites, only one is sanitised. |
| F111 | `SECRETS_ROTATION.md:155-168` | ✅ REAL | HTML-comment block contains live PEM private key + install token. |
| F124 | `libs/analytics/src/lib/reporting.service.ts:209-261` | TBD | Spot-check at task start. |
| F125 | `apps/svc-metadata/src/app/packs/packs.service.ts:2132` | TBD | Spot-check at task start. |
| F126 | `apps/svc-metadata/src/app/packs/packs.controller.ts:17-20` | (allowlisted in W0 task 3 because PackInstallGuard handles auth) — VERIFY at task start that PackInstallGuard is sufficient. |
| F127 | `apps/svc-notify/src/app/notifications/template-engine.service.ts:36-48` | TBD | Spot-check at task start. |
| F139, F141 | `libs/enterprise/src/lib/sso.service.ts:101-124, 182, 211, 285-303` | TBD | 347-line file; verify SAML signature + XML interpolation paths at task start. |

---

## Stream A — Day 1 Urgent (Cannot Wait)

### Task 1: F111 — Redact SECRETS_ROTATION.md HTML-comment block + flag rotation requirement

**Files:**
- Modify: `SECRETS_ROTATION.md:155-168`
- Test: rerun `gitleaks` locally to confirm no longer detected at HEAD

**Background:** The HTML-comment block holds a live Ed25519 private key (`PACK_SIGNING_PRIVATE_KEY`) and `PACK_INSTALL_TOKEN`. The doc's own step 4 says "Redact the HTML-comment block above from this file" — that step was missed when the doc shipped. The keypair is now in git history forever; even after redaction at HEAD, history-based extraction recovers it.

This task does what's safely automatable:
- Redacts the HTML comment.
- Adds a prominent SECURITY-INCIDENT block describing what's still required (operator-side keypair rotation + token reissue).

What this task does NOT do:
- Generate new keypair (operator must do this in a secure-vault environment with audit trail).
- Force-rewrite git history (separate ops task; coordinate with all clones).

- [ ] **Step 1: Replace lines 155-168 with redaction + incident block.**
- [ ] **Step 2: Add operator action items at top of doc (REVOKE OLD KEY, ISSUE NEW KEY, INVALIDATE OLD TOKEN).**
- [ ] **Step 3: Run `gitleaks` (W0) at HEAD; confirm no findings against the working tree.** History findings remain (intentional; tracked).
- [ ] **Step 4: Commit.**

**Acceptance:** `gitleaks` finds no PEM private key in the working tree at HEAD. `SECRETS_ROTATION.md` carries a clear incident notice that the leaked keypair is unrevoked until ops acts. The dev-only-insecure-secret allowlist entry in `.gitleaks.toml` stays until W1's history rewrite (separate task).

---

### Task 2: F088 — Fix Rules-of-Hooks violation in ProtectedRoute and PermissionGate

**Files:**
- Modify: `apps/web-client/src/routing/ProtectedRoute.tsx:22-24`
- Modify: `apps/web-client/src/auth/PermissionGate.tsx:17-18`
- Add `react-hooks` plugin (deferred from W0): `package.json` + `tools/approved-deps.json`
- Test: lint must surface this on a deliberate regression

**Background:** Both files call hooks conditionally:
```tsx
const hasPerm = permissions ? useHasPermission(permissions) : true;
```
This violates React's Rules of Hooks: hook count must be stable across renders. When the `permissions` prop toggles between truthy and undefined, React unmounts the subtree and warns in dev / throws in StrictMode.

Fix pattern: always call the hook unconditionally; branch on the boolean afterward.

- [ ] **Step 1: Refactor ProtectedRoute.tsx — call all 3 hooks unconditionally.**
- [ ] **Step 2: Same in PermissionGate.tsx.**
- [ ] **Step 3: Add `eslint-plugin-react-hooks` to `package.json` devDependencies + add to `tools/approved-deps.json` dev section with reason. Wire into `eslint.config.mjs` with `react-hooks/rules-of-hooks: 'error'`.**
- [ ] **Step 4: Sanity-test with a deliberate regression (toggle one of the hooks back to conditional, confirm lint catches; revert).**
- [ ] **Step 5: Commit.**

**Acceptance:** `npx eslint apps/web-client/src/routing/ProtectedRoute.tsx apps/web-client/src/auth/PermissionGate.tsx` exits 0. `react-hooks/rules-of-hooks: error` is configured in `eslint.config.mjs`.

---

### Task 3: F053 — Remove default-password fallback in svc-migrations

**Files:**
- Modify: `apps/svc-migrations/src/main.ts:51-53`
- Test: `tools/scanner-self-test.ts` style — plant fixture that omits env vars and verify migration job throws.

**Background:** Lines 51-53 default DB_USER/DB_PASSWORD/DB_NAME to `'hubblewave'`. If env vars are unset (e.g., misconfigured K8s manifest), the migration job runs against `hubblewave:hubblewave@.../hubblewave`, which is the dev-default and ships in `.env.example`. Production migrations against the wrong DB silently succeed.

- [ ] **Step 1: Replace `?? 'hubblewave'` with explicit `throw` on missing env var.**
- [ ] **Step 2: Add a small spec or runtime self-test that exec's the entry with no env and confirms exit non-zero.**
- [ ] **Step 3: Commit.**

**Acceptance:** Running `node dist/apps/svc-migrations/main.js` with no env exits non-zero with a clear error citing the missing var.

---

### Task 4: F011 — LDAP filter injection (RFC 4515 escaping)

**Files:**
- Modify: `apps/svc-identity/src/app/ldap/ldap.service.ts:54`
- Add: `apps/svc-identity/src/app/ldap/ldap-filter-escape.ts` (the escape helper) + spec.

**Background:** `filter.replace('{username}', username)` interpolates raw user input. RFC 4515 reserves `*`, `(`, `)`, `\`, NUL — each must be escaped to its `\HH` hex form. Without escaping, an attacker can inject filter logic.

- [ ] **Step 1: Write the test.** Plant a fixture username `*)(uid=*` and assert the escape helper produces `\2a\29\28uid=\2a` (or whatever the canonical escape is).
- [ ] **Step 2: Implement `escapeLdapFilter()`** — character-by-character map of `\` → `\5c`, NUL → `\00`, `*` → `\2a`, `(` → `\28`, `)` → `\29`.
- [ ] **Step 3: Wire into `ldap.service.ts:54`** — wrap `username` with `escapeLdapFilter(username)` before substitution.
- [ ] **Step 4: Run the spec; commit.**

**Acceptance:** Spec passes; ldap.service.ts always escapes before interpolation. Crafted username inputs (`*`, `(`, `\`) cannot manipulate the filter semantics.

---

## Stream B — Day 1-2 Code-Execution & Data-Exfiltration Vectors

### Task 5: F124 — SQL injection in custom report queries

**Files:**
- Modify: `libs/analytics/src/lib/reporting.service.ts:209-261` — DELETE the `dataSource.type === 'query'` branch entirely.
- Test: `reporting.spec.ts` — assert that a report config with `dataSource.type: 'query'` is rejected at validation time.

**Background:** The audit cited string-substituted `${key}` interpolation with single-quote-only escaping. Even with the escape, number-typed params land as raw SQL. This branch is irredeemable; remove rather than salvage. If customers have reports relying on it, the migration path is parameterized typeorm queries.

- [ ] **Step 1: Verify finding still exists.** `grep -n "dataSource.type" libs/analytics/src/lib/reporting.service.ts`.
- [ ] **Step 2: Identify any callers** that might be affected by removal.
- [ ] **Step 3: Write the failing test.** Construct a report config with `dataSource.type: 'query'`, assert the runner rejects with a structured "raw queries no longer supported" error.
- [ ] **Step 4: Delete the branch + emit the rejection error.**
- [ ] **Step 5: Run test; commit.**

**Acceptance:** No raw-SQL execution path in `libs/analytics/`. Spec covers the reject behavior. Any pre-existing report definitions of `type: 'query'` get a startup-time warning so operators know to migrate.

---

### Task 6: F125 + F126 — Pack download SSRF + Pack controller auth

**Files:**
- Modify: `apps/svc-metadata/src/app/packs/packs.service.ts:2132` — wire `validateOutboundUrl()` from `libs/integrations`.
- Modify: `apps/svc-metadata/src/app/packs/packs.controller.ts` — verify PackInstallGuard remains sole gate; if @Public() removal is needed, do here.
- Test: SSRF fixture URLs (169.254.169.254, internal hostnames) → rejected.

**Background:** `fetch(artifactUrl, { signal })` is invoked BEFORE PackInstallGuard validates the request, AND the URL is unrestricted. Combined with @Public on the controller (intended to defer auth to PackInstallGuard), an authenticated user with a valid pack-install token can ride the SSRF.

- [ ] **Step 1: Verify finding still exists.**
- [ ] **Step 2: Verify `libs/integrations/src/lib/url-validator.ts` exists and exports `validateOutboundUrl()`.**
- [ ] **Step 3: Write the test.** `validateOutboundUrl('http://169.254.169.254/latest/meta-data')` throws.
- [ ] **Step 4: Wire into pack download path.** Validate BEFORE the fetch.
- [ ] **Step 5: Re-evaluate F126.** PackInstallGuard already gates auth; W0 task 3 documents this in PUBLIC_ALLOWLIST. Verify the guard order and that maintenance-mode flag is set BEFORE artifact fetch (audit's secondary finding F129).
- [ ] **Step 6: Commit.**

**Acceptance:** Pack install with SSRF-style URL fails at validate; never reaches `fetch`. Test runs in CI.

---

### Task 7: F127 — Notification template `{{{ raw }}}` XSS

**Files:**
- Modify: `apps/svc-notify/src/app/notifications/template-engine.service.ts:36-48` — DELETE the triple-brace path.
- Test: a template with `{{{ field }}}` and a payload containing `<script>` produces sanitized output (or rejects the template at register time).

**Background:** Triple-brace inserts unsanitized HTML. Combined with record-derived data (which can contain user input), this is stored XSS that ships from an authenticated SMTP relay.

- [ ] **Step 1: Verify finding.**
- [ ] **Step 2: Write the failing test.** Render template with payload `{ field: '<img src=x onerror=alert(1)>' }`; assert no `<script>` or unescaped HTML in output.
- [ ] **Step 3: Delete the triple-brace pre-pass.** Route ALL substitutions through DOMPurify with email-safe ALLOWED_TAGS.
- [ ] **Step 4: Migration concern:** if any existing templates use `{{{ }}}`, surface them with a startup-time warning so operators know to convert.
- [ ] **Step 5: Commit.**

**Acceptance:** No triple-brace handling in template engine. Spec covers the sanitization path.

---

### Task 8: F027 — `expr-eval` sandbox in process-flow engine

**Files:**
- Create: `libs/safe-expr/` (or `libs/instance-db` sub-folder, depending on sourcing decision)
- Modify: `libs/automation/src/lib/process-flow-engine.service.ts:89, 521`
- Modify (later cleanup): `apps/svc-automation/src/app/runtime/script-sandbox.service.ts` to share the same wrapper.

**Background:** Process-flow uses bare `expr-eval` Parser with no denylist, no AST depth cap, no length cap, no timeout. The other three callers in the codebase (`script-sandbox.service.ts`, `validation.service.ts`, `default-value.service.ts`) wrap `expr-eval` in BLOCKED_PATTERNS + length cap + Promise-race timeout. Process-flow has none. Any process-flow author can write `constructor.constructor('return process')().exit(1)` and crash the worker.

- [ ] **Step 1: Verify finding (line 89, 521).**
- [ ] **Step 2: Extract the existing hardened pattern from `script-sandbox.service.ts` into a new `libs/safe-expr/`.** Single source of truth for BLOCKED_PATTERNS + length cap + AST depth + timeout race.
- [ ] **Step 3: Write the failing test.** RCE-style expressions (`constructor.constructor`, `__proto__`, `eval`, etc.) get rejected.
- [ ] **Step 4: Replace direct Parser uses in `process-flow-engine.service.ts:89, 521` with the wrapper.**
- [ ] **Step 5: (Defer to W7 task on duplicates) Migrate the other 3 callers to the same wrapper.** W7 owns this consolidation.
- [ ] **Step 6: Commit.**

**Acceptance:** No `new Parser()` outside `libs/safe-expr/`. RCE-pattern test passes. Existing `script-sandbox.service.spec.ts` still passes (no regression).

---

### Task 9: F073 — Vector-search authorization

**Files:**
- Modify: `libs/ai/src/lib/vector-store.service.ts` — add `RequestContext` parameter to search methods; pre-filter results by user permission.
- Modify: callers in `libs/ai/src/lib/rag.service.ts`, `apps/svc-ava/...` to pass context.
- Test: vector search with two users and per-collection permissions returns disjoint results.

**Background:** `WHERE 1 = 1` queries; no `RequestContext` parameter. RAG silently leaks records across permission boundaries.

- [ ] **Step 1: Verify (search method signatures).**
- [ ] **Step 2: Write the failing test.** Two users; user A indexes a document in `collection-a`; user B (no read on `collection-a`) issues semantic query that would match → assert empty results for B.
- [ ] **Step 3: Add `RequestContext` parameter to all search methods.** Reject calls without context (no default value).
- [ ] **Step 4: Pre-filter at the SQL level.** Join through `CollectionDefinition` and apply `buildCollectionRowLevelClause`.
- [ ] **Step 5: Update all callers.** Each call site must thread context through.
- [ ] **Step 6: Commit.**

**Acceptance:** Vector search test passes. Calls without context fail at the type system + runtime.

---

## Stream C — Day 3 Frontend & XSS

### Task 10: F089 — Control Plane localStorage → in-memory + HttpOnly cookie

**Files:**
- Modify: `apps/web-control-plane/src/app/services/auth.ts` — mirror the in-memory pattern from `apps/web-client/src/services/token.ts`.
- Modify: `apps/web-control-plane/src/app/services/api.ts` — coordinate refresh.

**Background:** Control Plane is the highest-privilege admin console. Storing access + refresh tokens in localStorage means any XSS in the admin UI exfiltrates the entire session. The instance-side `web-client` already gets this right.

- [ ] **Step 1: Verify (auth.ts:38, 62-64, 88-90).**
- [ ] **Step 2: Read `apps/web-client/src/services/token.ts` as the canonical pattern.**
- [ ] **Step 3: Refactor `auth.ts`** — access token in module-scoped variable; refresh token via HttpOnly cookie set by control-plane API (server-side change may be needed if cookie isn't currently set).
- [ ] **Step 4: Update `api.ts` interceptor** — single-flight refresh, retry-on-401.
- [ ] **Step 5: Cross-tab logout via `storage` event** (mirror `apps/web-client/src/auth/AuthContext.tsx`).
- [ ] **Step 6: Test in browser** (this fix needs UI verification per CLAUDE.md frontend rule).
- [ ] **Step 7: Commit.**

**Acceptance:** No `localStorage.setItem` for token/refresh in control-plane web. Tab-1 logout invalidates Tab-2's session within seconds.

---

### Task 11: F093 — Three `dangerouslySetInnerHTML` sites; standardize sanitisation

**Files:**
- Modify: `apps/web-client/src/components/formula/FormulaEditor/FormulaEditor.tsx:353`
- Modify: `apps/web-client/src/features/phase7/living-docs/LivingDocsPage.tsx:257`
- Re-verify: `apps/web-client/src/features/.../AIReportsPage.tsx:350-363` is already sanitised correctly.

**Background:** Per audit, only one of the three sites uses DOMPurify with explicit ALLOWED_TAGS. The other two either skip DOMPurify or call it with no config (default config blocks scripts but is inconsistent).

- [ ] **Step 1: Verify all three sites.**
- [ ] **Step 2: Extract a shared `sanitizeHtml(content, profile)` helper** with explicit profiles (rich-text, formula-highlight, ai-report).
- [ ] **Step 3: Replace each site to call the helper with the right profile.**
- [ ] **Step 4: Test fixture inputs containing `<script>`, `<img onerror>`, `<iframe>` etc.**
- [ ] **Step 5: Commit.**

**Acceptance:** All three sites use the same sanitization helper. Test passes.

---

## Stream D — Day 4 SAML & SSO Hardening

### Task 12: F139 — SAML JIT-provision + signature verification

**Files:**
- Modify: `libs/enterprise/src/lib/sso.service.ts:182, 211, 247, 285-303` — add `crypto` import; verify SAML response signature; reject if unsigned/invalid.

**Background:** Audit cited bare `crypto.randomUUID()` without import (compiles only because of Node global), AND no signature verification on SAML assertions. JIT provisioning matches users by email → IdP can claim any email.

- [ ] **Step 1: Verify findings (re-grep around the cited lines).**
- [ ] **Step 2: Write tests** — valid signed assertion accepted; tampered signature rejected; unsigned assertion rejected.
- [ ] **Step 3: Add proper `import { randomUUID } from 'crypto'`.**
- [ ] **Step 4: Add SAML signature verification path** using `xml-crypto` or similar (add to approved-deps with reason).
- [ ] **Step 5: Default `email_verified` to `false`** for IdP that omits it; require explicit allowlist of trusted IdP IDs.
- [ ] **Step 6: Commit.**

**Acceptance:** Tests pass; auto-provision rejects unsigned/tampered assertions.

---

### Task 13: F141 — SAML metadata XML interpolation

**Files:**
- Modify: `libs/enterprise/src/lib/sso.service.ts:101-124` — replace string-template XML construction with a real XML builder (`xmlbuilder2` or similar).
- Add `xmlbuilder2` to `tools/approved-deps.json`.

**Background:** `baseUrl` and `config.id` are template-interpolated into XML. If `config.id` ever contains `"`, the XML becomes injectable.

- [ ] **Step 1: Verify finding.**
- [ ] **Step 2: Write a test** — config.id with embedded `"` produces well-formed XML (escaped, not injected).
- [ ] **Step 3: Replace template-string with XML builder.**
- [ ] **Step 4: Commit.**

**Acceptance:** XML output passes a parser even with adversarial config.id; no string concatenation in XML construction.

---

## Stream E — Wave Verification + Canon Amendment

### Task 14: Re-run all W0 scanners + new W1-specific tests; verify zero regressions.
### Task 15: Author `docs/plan-fixes/W01-acceptance.md`.
### Task 16: Amend CLAUDE.md to reflect W1 closures.

---

## Risks Carried Forward

- **F111 keypair revocation requires operator action** — the doc redaction is necessary but not sufficient; ops must rotate the keypair AND force-rewrite git history (separate task tied to coordinator-led announcement).
- **W0 ESLint rules already catch some W1 fixes** — e.g., F088 hooks rule will turn the W1 fix into a permanent lint gate.
- **F125 SSRF guard has a known scoped tradeoff** — `validateOutboundUrl()` blocks RFC1918, link-local, IPv4-mapped, etc. Customer integrations targeting on-prem private-IP services would also be blocked. Document the carve-out mechanism (per-tenant allowlist) for the integration path; pack download is correctly strict.

---

## Self-Review

**Spec coverage:** All 15 W1-owned findings have a task. F104 already closed in W0; F088 lint rule comes alive in this wave too.

**Type/symbol consistency:** `validateOutboundUrl` exists in `libs/integrations/src/lib/url-validator.ts` (verified during W0). `escapeLdapFilter` is new in Task 4. `safeExpr` lib is new in Task 8. `sanitizeHtml` helper is new in Task 11.

**Placeholder scan:** Tasks have explicit code locations and test patterns. The "TBD" entries in the verification table are explicit pre-task-start spot-checks (per W0's lesson).

---

## Execution Handoff

This session ships Tasks 1, 2, 3, 4 (F111 redact + F088 hooks + F053 env + F011 LDAP escape). The remaining 12 tasks each warrant their own focused turn for the surgery + test work involved.

Next-up priority order after this turn:
1. F124 (Task 5) — SQL injection, single-file fix
2. F127 (Task 7) — Triple-brace XSS, single-file fix
3. F125 + F126 (Task 6) — pack SSRF + auth, two files
4. F027 (Task 8) — expr-eval sandbox + new lib
5. F073 (Task 9) — vector authz, multiple callers
6. F089 (Task 10) — Control Plane localStorage, browser-test required
7. F093 (Task 11) — Three sites + shared helper
8. F139 + F141 (Tasks 12-13) — SAML hardening, two related fixes
9. Tasks 14-16 — verification + canon amendment
