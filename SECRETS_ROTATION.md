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

- New environment variables (both must be set on every service that signs or verifies platform JWTs):
  - `JWT_AUDIENCE` - default `hubblewave-instance` if unset
  - `JWT_ISSUER` - default `hubblewave-identity` if unset
- The signer (`auth.service.ts`) and the verifier (`jwt.strategy.ts`) read the same env vars and must be deployed in lockstep. If only the verifier rolls out first, all currently-issued tokens immediately stop validating.
- Operationally this is equivalent to a forced re-login: roll the change during a maintenance window, or schedule it alongside the next `JWT_SECRET` rotation so the user impact is amortized into a single re-auth event.
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
