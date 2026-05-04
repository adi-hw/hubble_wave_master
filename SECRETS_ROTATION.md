# Secrets Rotation Manifest

This document tracks every credential that was leaked into the HubbleWave git
history via `.env.backup` and `infrastructure/terraform/**/terraform.tfvars`.
The plaintext files have been removed from the working tree, but they remain
in git history. **Every credential listed below must be considered compromised
and rotated at its source of truth.**

History rewrite (`git filter-repo` / BFG) is tracked as a separate ops task.
Rotation is the only action that actually invalidates the leaked values.

---

## 1. CONTROL_PLANE_DB_USER / CONTROL_PLANE_DB_PASSWORD

- **Severity:** High
- **Where it was leaked:** `.env.backup` lines 4 (`CONTROL_PLANE_DB_USER=hubblewave`) and 5 (`CONTROL_PLANE_DB_PASSWORD=hubblewave`)
- **Action:** Rotate the PostgreSQL role password on the control-plane RDS cluster (`hubblewave-control-postgres`). Recreate or rename the `hubblewave` role if reuse is undesirable.
- **Where the new value belongs:** AWS Secrets Manager path `hubblewave/control-plane/db` and the local `CONTROL_PLANE_DB_PASSWORD` env var on developer machines (untracked `.env`).

## 2. JWT_SECRET / IDENTITY_JWT_SECRET

- **Severity:** Critical (signing key for all platform JWTs)
- **Where it was leaked:** `.env.backup` line 14 (`JWT_SECRET=dev-only-insecure-secret`). The same literal was previously hardcoded as a dev fallback in `apps/svc-view-engine/src/main.ts`, `apps/svc-metadata/src/main.ts`, and `libs/auth-guard/src/lib/auth-guard.module.ts` (now removed — services fail closed if the env var is missing).
- **Action:** Generate a fresh 64-byte secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`. Invalidate all in-flight JWTs; force re-login.
- **Where the new value belongs:** AWS Secrets Manager path `hubblewave/control-plane/jwt-secret` and `hubblewave/instances/<instance-id>/jwt-secret`, surfaced as `JWT_SECRET` / `IDENTITY_JWT_SECRET` env vars.

### 2a. JWT claim migration (audience + issuer)

Wave 3 added mandatory `aud` and `iss` claim verification to the identity service. Tokens minted before this rollout do not carry these claims and will fail signature verification once the new strategy is deployed.

- New environment variables (both must be set on **every** backend service that signs or verifies platform JWTs - not just `svc-identity`):
  - `JWT_AUDIENCE` - default `hubblewave-instance` if unset (development only)
  - `JWT_ISSUER` - default `hubblewave-identity` if unset (development only)
- Wave 5 adds a build-time `assertJwtConfig()` pre-flight in `libs/shared-types` (`security/jwt-config.ts`), invoked from each service's `main.ts` alongside `assertSecureConfig()`. In production (`NODE_ENV=production`) the pre-flight throws if either variable is unset; in non-prod it logs a warning. The covered services are: `svc-identity`, `svc-metadata`, `svc-data`, `svc-notify`, `svc-control-plane`, `svc-ava`, `svc-workflow`, `svc-automation`, `svc-instance-api`, `svc-insights`, `svc-view-engine`.
- An optional `JWT_AUDIENCE_EXPECTED` env var, when set on a service, is compared against `JWT_AUDIENCE` and a mismatch throws at startup in any environment. Set this to a single shared deployment-time value across all services to catch "audience=foo on identity but audience=bar on data" misconfigurations before tokens start flowing.
- The signer (`auth.service.ts`) and the verifier (`jwt.strategy.ts`) read the same env vars and must be deployed in lockstep. If only the verifier rolls out first, all currently-issued tokens immediately stop validating.
- Operationally the migration is equivalent to a **forced re-login** - no in-flight tokens survive. Roll during a maintenance window, or schedule it alongside the next `JWT_SECRET` rotation so the user impact is amortized into a single re-auth event.
- The verifier also accepts a 30 second `clockTolerance` to absorb skew between the identity service and downstream verifiers; this does not weaken token expiry, only smooths cross-host clock drift.

## 3. PACK_INSTALL_TOKEN / CONTROL_PLANE_INSTANCE_TOKEN

- **Severity:** High (allows pack installation against control plane)
- **Where it was leaked:** `.env.backup` lines 17 and 21 (literal `6272fe49f5eb551d087750cad08ea1da26ce039e5973fbed0c201a1fdfe9adb6`)
- **Action:** Revoke the leaked token in the control-plane token registry. Issue a new token via the control-plane admin tooling.
- **Where the new value belongs:** AWS Secrets Manager path `hubblewave/control-plane/pack-install-token`, distributed to instance runtimes as `PACK_INSTALL_TOKEN` and `CONTROL_PLANE_INSTANCE_TOKEN` env vars.

## 4. PACK_SIGNING_PRIVATE_KEY

- **Severity:** Critical (any code-signing key leak compromises the supply chain)
- **Where it was leaked:** `.env.backup` line 19 (Ed25519 private key in PEM form). The matching public key (`PACK_SIGNING_PUBLIC_KEYS`, line 18) under key id `hw-pack-signing-primary` is also burned.
- **Action:** Wave 1 sibling agent (S3) will generate a fresh Ed25519 keypair. Retire key id `hw-pack-signing-primary`; publish a new key id (e.g., `hw-pack-signing-2026-04`). Re-sign all in-flight packs with the new key. Add the old key id to a `revoked_key_ids` list in the pack verifier.
- **Where the new value belongs:** Private key in AWS Secrets Manager path `hubblewave/control-plane/pack-signing-private-key` (env var `PACK_SIGNING_PRIVATE_KEY`); public key set in `PACK_SIGNING_PUBLIC_KEYS` env var across all verifying services.

## 5. Cloudflare API Token

- **Severity:** Critical (zone-level DNS write access)
- **Where it was leaked:** `infrastructure/terraform/environments/production/terraform.tfvars` line 8 and `infrastructure/terraform/instances/hubblewave-dev/terraform.tfvars` line 27 (literal `fu5C_DPDlQHNUvGk4rwINZzuwhJMIuGLFi0VTKEe`, scoped to zone `f8508c6f0028592bb117233ec936f99f` / `hubblewave.com`).
- **Action:** Revoke the token in the Cloudflare dashboard (My Profile -> API Tokens). Mint a new scoped token with the minimum permissions terraform needs (Zone:DNS:Edit on `hubblewave.com`).
- **Where the new value belongs:** AWS Secrets Manager path `hubblewave/terraform/cloudflare-api-token`. Sourced into terraform via `TF_VAR_cloudflare_api_token` env var or via the local untracked `terraform.tfvars` (now gitignored).

## 6. HuggingFace Token

- **Severity:** Medium (model download access tied to a HuggingFace account)
- **Where it was leaked:** `infrastructure/terraform/instances/hubblewave-dev/terraform.tfvars` line 47 (literal `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`)
- **Action:** Revoke the token in HuggingFace account settings (Access Tokens). Issue a new token scoped to read-only access for the gated `meta-llama` repo.
- **Where the new value belongs:** AWS Secrets Manager path `hubblewave/instances/hubblewave-dev/huggingface-token`, sourced as `TF_VAR_huggingface_token` and as the `HUGGINGFACE_TOKEN` env var on the vLLM pod.

## 7. Production db_password / db_admin_password

- **Severity:** Critical
- **Where it was leaked:** `infrastructure/terraform/environments/production/terraform.tfvars` lines 15 and 17 (both equal to `?HX&sbXegAU)jzTwCM*crWEg?DxP7!&%`)
- **Action:** Rotate both the application role password and the admin role password on the production control-plane RDS instance (`hubblewave-control-postgres`). Use distinct values for app vs admin. Update all running services with the new application password before retiring the old one.
- **Where the new value belongs:** AWS Secrets Manager paths `hubblewave/control-plane/db-app-password` and `hubblewave/control-plane/db-admin-password`. Sourced into terraform via `TF_VAR_db_password` and `TF_VAR_db_admin_password`.

## 7a. BACKUP_SIGNING_KEY

- **Severity:** Critical (HMAC key that authenticates backup manifests + Typesense schemas before restore)
- **Source:** Wave 3 introduces this secret. There is no leaked predecessor; this is a new key class.
- **Generation:** `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- **Where the new value belongs:** AWS Secrets Manager path `hubblewave/instances/<instance-id>/backup-signing-key`, sourced as the `BACKUP_SIGNING_KEY` env var on every `svc-insights` pod that runs the backup/restore worker.
- **Operational notes:**
  - The backup S3 bucket MUST have server-side encryption (SSE-S3 or SSE-KMS) enabled. The signing key protects integrity; SSE protects confidentiality at rest.
  - The Terraform state backend block emitted by `terraform.workspace.service.ts` already carries `encrypt = true`; verify the bucket-level default is also set so that any out-of-band tooling (e.g., backup workers writing to a sibling bucket) inherits encryption.
  - Rotation cadence: every 12 months, or immediately on suspected exposure. After rotation, existing manifests remain restorable only with the prior key — keep the previous value in `BACKUP_SIGNING_KEY_PREVIOUS` for one full retention window before purging.

## 7b. INSTANCE_HUGGINGFACE_TOKEN (control-plane provisioning input)

- **Severity:** Medium
- **Where it was leaked:** Previously rendered into `main.tf` as plaintext HCL by `terraform.workspace.service.ts`. Wave 3 moves the value to a sibling `terraform.tfvars.json` file passed via `-var-file`, with the variable marked `sensitive = true` in `variables.tf`.
- **Operational notes:**
  - `terraform.tfvars.json` is generated per workspace and MUST be excluded from any backup or shared workspace mirror; treat it like a private key file.
  - The Terraform state backend MUST have encryption-at-rest enabled (S3 SSE on `INSTANCE_TERRAFORM_STATE_BUCKET`). Sensitive variables are masked in plan/apply output but persist into state in the clear.

## 8. License Key Placeholder (dev instance)

- **Severity:** Low (`dev-license-key-placeholder`, never a real key)
- **Where it was leaked:** `infrastructure/terraform/instances/hubblewave-dev/terraform.tfvars` line 12
- **Action:** No revocation needed. Generate a real dev license via the licensing service when the dev instance is next stood up.
- **Where the new value belongs:** AWS Secrets Manager path `hubblewave/instances/hubblewave-dev/license-key`, sourced as `TF_VAR_license_key`.

---

## 13. Control-plane server-side logout endpoint (shipped in Wave 5)

- **Severity:** Medium (token/session lifecycle hygiene)
- **Status:** Shipped in Wave 5.
- **What shipped:**
  - `POST /auth/logout` on `svc-control-plane` - any authenticated operator/admin/super_admin can call it to revoke the current bearer token. Returns `204 No Content`.
  - Login now mints a `jti` claim on every access token (`crypto.randomUUID()`), so individual tokens can be surgically revoked without rotating `JWT_SECRET`.
  - A new `revoked_tokens` table in the control-plane database (migration `1823000000000-revoked-tokens.ts`) stores `{jti, userId, expiresAt, revokedAt, ipAddress, userAgent}`. The `JwtStrategy.validate()` consults this table on every request and rejects tokens whose `jti` appears in it.
  - The web-control-plane `authService.logout()` now calls `POST /auth/logout` before clearing localStorage, wrapped in a try/catch so a network failure still results in a clean local sign-out.
  - Logout events emit a `auth.logout` row in `control_plane_audit_log` with actor, IP, UA, and `jti`.
- **Operational notes:**
  - Tokens issued **before** this rollout do not carry a `jti` claim. Logout will reject them with a clear `UnauthorizedException` because there is nothing to revoke; operators on legacy tokens must either let the token expire naturally or rotate `JWT_SECRET`. After Wave 5 deploys, the next login mints a `jti`-bearing token and logout works as designed.
  - `revoked_tokens` rows can be pruned once `expiresAt` has passed; `AuthService.purgeExpiredRevocations()` is provided for a future scheduled job. There is no leak from a row sitting longer than necessary, only mild table bloat.
  - This implementation uses PostgreSQL (already provisioned for the control-plane) rather than Redis. No new infrastructure dependency; no new env var needed beyond the existing control-plane DB.
- **Compensating controls (still relevant):** `JWT_SECRET` rotation (section 2) remains the nuclear option for invalidating every token platform-wide simultaneously, e.g. on suspected signing-key compromise.

---

## Rotation Order

1. JWT_SECRET (forces re-login; do during a maintenance window).
2. PACK_SIGNING_PRIVATE_KEY (coordinate with Wave 1 / S3).
3. Cloudflare API token, HuggingFace token (revoke first, then mint replacement, then re-run terraform).
4. Database passwords (app role first, then admin role).
5. PACK_INSTALL_TOKEN / CONTROL_PLANE_INSTANCE_TOKEN.
6. License key placeholder (lowest priority).

## Verification

After rotation, confirm the leaked literals no longer authenticate:

- Cloudflare: `curl -H "Authorization: Bearer fu5C_DPDlQHNUvGk4rwINZzuwhJMIuGLFi0VTKEe" https://api.cloudflare.com/client/v4/user/tokens/verify` must return 401.
- HuggingFace: `curl -H "Authorization: Bearer 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" https://huggingface.co/api/whoami-v2` must return 401.
- PACK_INSTALL_TOKEN: control-plane pack install endpoint must reject the old token.
- JWT_SECRET: any JWT signed with `dev-only-insecure-secret` must fail signature verification.
- DB passwords: psql with the old password must fail to authenticate.

---

## Wave 1 / S3 — Replacement Values for Pack Signing & Install Token

**SET THESE AS ENV VARS, DO NOT COMMIT.** These values were generated locally and
are recorded here as a one-time handoff so the operator can move them into AWS
Secrets Manager. Once the operator has them in the secrets store, this section
should be redacted.

Generation:
- Keypair: `npx ts-node scripts/generate-pack-signing-keypair.ts`
- Install token: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- New `signing.public_key_id` (replaces retired `hw-pack-signing-primary`): `hw-pack-signing-2026-04`

<!--
PACK_SIGNING_PUBLIC_KEY (PEM, multi-line; consumed by svc-instance-api)
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAweF6SMWRjsI7FCyYiWaa82WOeSYAVPFEVyYnfaMRqSY=
-----END PUBLIC KEY-----

PACK_SIGNING_PRIVATE_KEY (PEM, multi-line; consumed by scripts/build-pack.ts)
-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIBBoeSa++mdr7N3Kkd2Jqe2hCj7wURT2rPahdoj6hrZ+
-----END PRIVATE KEY-----

PACK_INSTALL_TOKEN
62309f11f63c0fbf1119522bfb9030395ac608ac86ec8c75ea61ca99fa4bcde7
-->

Operator checklist:

1. Copy the three values above into AWS Secrets Manager:
   - `hubblewave/control-plane/pack-signing-private-key`
   - `hubblewave/control-plane/pack-signing-public-key`
   - `hubblewave/control-plane/pack-install-token`
2. Distribute as env vars `PACK_SIGNING_PRIVATE_KEY` (build-pack tool only),
   `PACK_SIGNING_PUBLIC_KEY` (svc-instance-api), and `PACK_INSTALL_TOKEN`
   (svc-instance-api + control-plane caller).
3. Add the retired key id `hw-pack-signing-primary` to the verifier's
   `revoked_key_ids` list.
4. Redact the HTML-comment block above from this file.

---

## Wave 4 Additions

### CI/CD action SHA pinning (Wave 5 — shipped)

All third-party GitHub Actions in `.github/workflows/*.yml` are now
pinned to 40-character commit SHAs with the human-readable version as a
trailing comment. First-party `actions/*` (`actions/checkout`,
`actions/setup-node`, `actions/upload-artifact`, `actions/download-artifact`)
remain on major-version tags per Wave 1's spec — Microsoft maintains them
and the floating-tag risk is acceptable.

Pinned in Wave 5: `nrwl/nx-set-shas`, `codecov/codecov-action`,
`aquasecurity/trivy-action` (and the tag form was corrected from `0.28.0`
to `v0.28.0`), `hashicorp/setup-terraform`, `aws-actions/configure-aws-credentials`,
`azure/setup-kubectl`, `azure/setup-helm`, `azure/k8s-set-context`,
`docker/setup-buildx-action`, `docker/login-action`, `docker/metadata-action`,
`docker/build-push-action`, `slackapi/slack-github-action`,
`softprops/action-gh-release`. SHAs were resolved via
`gh api repos/<owner>/<action>/git/ref/tags/<tag>` (with one level of
indirection for annotated tags).

Operator: when bumping any of these to a newer version, re-run the same
`gh api` lookup for the new tag and update both the SHA and the trailing
comment. Never reintroduce a floating tag.

### ElastiCache Redis AUTH (Wave 4 / item 3)

The customer-instance Terraform module now provisions ElastiCache via
`aws_elasticache_replication_group` with at-rest encryption, transit
encryption, and an AUTH token generated by `random_password.redis_auth`.
The token is exposed to instance pods as `REDIS_AUTH_TOKEN` and embedded
in `REDIS_URL` under the `rediss://` scheme.

- **Generation:** Terraform-managed, regenerated on `terraform apply` if
  the resource is replaced. Output `redis_auth_token` is `sensitive`.
- **Where the value belongs:** AWS Secrets Manager path
  `hubblewave/instance/<env>/<customer>/<instance-id>/redis`, as the
  `REDIS_AUTH_TOKEN` JSON field. Wired through
  `aws_secretsmanager_secret.redis`.
- **Rotation:** `auth_token_update_strategy = "ROTATE"` lets a new token
  coexist with the previous one for one rotation cycle, allowing
  zero-downtime client rollover.
- **Note:** Existing instances pre-dating Wave 4 must be re-applied;
  enabling transit encryption requires resource replacement and so a
  maintenance window.

### HF token: Kubernetes secret reference (Wave 4 / item 5)

The vLLM init container previously read `HF_TOKEN` from a Terraform
variable rendered into the pod spec env block in plaintext. Wave 4
switches it to `value_from.secret_key_ref` against the existing
`huggingface-token` Kubernetes Secret. The pod manifest no longer
contains the token; only the Secret holds it. Rotation procedure is
unchanged - update Terraform input `huggingface_token`, re-apply, roll
the vLLM Deployment.

### Image digest pinning (Wave 4 / item 6)

`control-plane-deploy.yaml` no longer references the mutable `:v1` tag;
the image field is now `:WILL_BE_REPLACED_BY_CD`. The CD workflow no
longer pushes `:latest` for the main branch. Operators must rewrite the
manifest's image references to an immutable digest
(`image@sha256:<digest>`) before applying. Wave 5 materialises the Helm
charts referenced by `cd.yml` at `infrastructure/helm/control-plane/`
and `infrastructure/helm/instance-services/`; CD now passes the commit
SHA into `image.tag` so the digest substitution remains intact.

### IAM least privilege (Wave 4 / item 1)

`infrastructure/terraform/environments/production/main.tf` now grants the
control-plane role only the actions and resources documented in the
deployment runbook: `eks:Describe*` scoped to the control cluster ARN,
`iam:PassRole` only to the control-plane role itself with a
`PassedToService` condition, S3 GET/PUT/DELETE/LIST scoped to the
Terraform state and pack artifact buckets, DynamoDB lock table actions,
Secrets Manager actions scoped to `hubblewave/*`, RDS and ElastiCache
read-only describes, and `sts:GetCallerIdentity`. The previous
`Action: ["eks:*", "iam:*", "s3:*", ...]` is gone. If a new operational
need surfaces (e.g., the control plane begins managing CloudWatch
dashboards), extend the policy in a follow-up change rather than
broadening with a wildcard.

### Kubernetes RBAC scope (Wave 4 / item 2)

The previous monolithic `kubernetes_cluster_role.instance_manager` was
replaced by:

- `kubernetes_cluster_role.instance_manager_cluster` -- cluster-scoped,
  limited to namespace lifecycle, CRD read-only, node read-only, and
  ClusterRole/ClusterRoleBinding read-only.
- `kubernetes_role.instance_manager_namespace_template` -- a Role
  defined in the control-plane namespace that the customer-instance
  module replicates into each instance namespace, granting
  deployment/service/secret/configmap/ingress management within ONE
  namespace.

A leak of the control-plane SA token can no longer read or mutate
secrets across the cluster.

### NetworkPolicy default-deny (Wave 4 / item 9)

A new `infrastructure/kubernetes/network-policies/default-deny-ingress.yaml`
adds an ingress default-deny plus explicit allow paths for the ingress
controller and the monitoring namespace. Customer instance namespaces
provisioned via the customer-instance module receive an in-Terraform
default-deny NetworkPolicy at namespace creation
(`kubernetes_network_policy_v1.default_deny`).

## Bootstrap Admin Password (Wave 4)

The bootstrap admin user (`admin@hubblewave.local`) is no longer seeded
with a hardcoded password. The migration
`migrations/instance/1818000000000-seed-admin-user.ts` requires the
`DEFAULT_ADMIN_PASSWORD` environment variable at migration time, hashes
it with argon2id, and aborts if the variable is missing or shorter than
12 characters. The same is true for `scripts/seed-admin-user.ts`.

### Procedure

1. Generate a strong password (e.g.,
   `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`).
2. Set `DEFAULT_ADMIN_PASSWORD=<value>` in the migration environment
   (CI secret, Vault, AWS SSM Parameter, etc).
3. Run `nx run instance:migrate` (or the equivalent provisioning step).
4. Operators MUST log in once and immediately rotate the password via
   `/auth/change-password`. Audit logs record the rotation.
5. After rotation, remove `DEFAULT_ADMIN_PASSWORD` from the deployment
   environment to remove the cleartext from any further blast radius.

The password value is never persisted to source control, container
images, or migration metadata; only the argon2id hash is stored.

## Datasource Credentials (Wave 4)

The migration scripts `scripts/datasource-instance.ts` and
`scripts/datasource-control-plane.ts` no longer fall back to a default
password. They throw if `DB_PASSWORD` (instance) or
`CONTROL_PLANE_DB_PASSWORD` (control plane) is unset. Configure these
exclusively from your secrets store.

### TLS Posture

In production, certificate validation is mandatory. The datasources
default `rejectUnauthorized` to `true` whenever `NODE_ENV=production`.
Provide the RDS / Cloud SQL CA bundle via the `DB_SSL_CA` environment
variable (its value is passed straight to the `ssl.ca` option). For
non-production environments operators may opt out by setting
`DB_SSL_REJECT_UNAUTHORIZED=true` only when the DB is reachable over
self-signed TLS.

Required production env vars:

- `DB_SSL=true` (or `CONTROL_PLANE_DB_SSL` if so configured)
- `DB_SSL_CA` -- PEM contents of the database server's CA chain
- `NODE_ENV=production`

## PermissionsGuard fail-closed (Wave 4)

The `PermissionsGuard` in `libs/auth-guard` and the local
`apps/svc-identity/src/app/auth/guards/permissions.guard.ts` have been
flipped to deny-by-default. An endpoint that flows through these guards
without an explicit `@RequirePermission`, `@Roles`, `@AuthenticatedOnly`,
or `@Public` decorator now returns `403 Endpoint authorization not
configured`. This catches missing authorization decisions at the request
edge instead of granting silent access.

### Decorator selection guide

- `@Public()` -- no auth required (login, password reset request,
  health, OIDC initiate/callback). Allowlisted by
  `tools/security-bypass-check.ts`.
- `@AuthenticatedOnly()` -- any authenticated user; no specific
  permission. Use for self-service endpoints (`/auth/me`,
  `/auth/logout`, `/auth/change-password`).
- `@RequirePermission('<slug>')` -- specific permission required.
  Preferred for admin endpoints once a per-endpoint permission slug
  exists.
- `@Roles('admin', ...)` -- role-gated; enforced by `RolesGuard`.

If you add a new endpoint and forget any of these decorators, the guard
denies the request and logs the controller and method name at debug
level so the gap is visible in the next request log.
