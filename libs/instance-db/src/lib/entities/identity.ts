// libs/instance-db/src/lib/entities/identity.ts
//
// Identity-area entities: users, RBAC (roles, permissions, groups), sessions,
// authentication tokens, refresh tokens, service principals, signing keys, MFA,
// SSO/LDAP config, advanced auth (WebAuthn, magic-link, impersonation,
// delegation, device trust, behavioral analytics).
//
// Public API surface is unchanged — entities continue to be exported via
// the package barrel `@hubblewave/instance-db`. This file exists to make
// area ownership explicit and to ease future code navigation. See Plan
// Fix 24 PR-A for the restructure rationale.

export { User, UserStatus } from './user.entity';

export { Role, RoleScope } from './role.entity';
export { Permission } from './permission.entity';
export { RolePermission, UserRole, AssignmentSource } from './role-permission.entity';
export { Group, GroupType, GroupMember, GroupRole } from './group.entity';

export { PasswordPolicy, LdapConfig, SsoProvider } from './auth-config.entity';

export {
  PasswordHistory,
  PasswordResetToken,
  EmailVerificationToken,
  RefreshToken,
  ApiKey,
  MfaMethod,
  UserInvitation,
  SAMLAuthState,
  LoginAttempt,
} from './auth-tokens.entity';
export type { LoginAttemptResult, RefreshTokenRevokedReason } from './auth-tokens.entity';

export { KeyMetadata } from './key-metadata.entity';
export type {
  KeyProvider,
  KeyAlgorithm,
  KeyState,
} from './key-metadata.entity';

export { ServicePrincipal } from './service-principal.entity';

export {
  WebAuthnCredential,
  WebAuthnChallenge,
  MagicLinkToken,
  TrustedDevice,
  ImpersonationSession,
  Delegation,
  BehavioralProfile,
  SecurityAlert,
} from './advanced-auth.entity';
export type {
  DeviceTrustStatus,
  DelegationStatus,
  AlertSeverity,
  AlertStatus,
} from './advanced-auth.entity';
