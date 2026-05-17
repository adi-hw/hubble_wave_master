export * from './lib/authorization.service';
export * from './lib/authorization.module';
export * from './lib/policy-compiler.service';
export * from './lib/types';
export type {
  DecisionProvenance,
  FieldDecisionProvenance,
  DecisionEffect,
  FieldDecisionEffect,
} from './lib/provenance';
export { AbacService, SafePredicate, LeafPredicate, OrPredicate, NotPredicate } from './lib/abac.service';
// W2 Stream 2 PR6: AccessAuditPort moved to @hubblewave/auth-guard so
// the PermissionsGuard + CollectionAccessGuard can call it on 403
// without creating a cycle through libs/authorization. The
// authorization library still consumes the port (the evaluator may
// log AccessDenied for field-level decisions), but it now imports
// the symbols from auth-guard instead of defining them locally.
export type {
  AccessAuditPort,
  AccessAuditEvent,
  AccessDeniedEvent,
  AuditedDecisionProvenance,
  SecurityAuditEvent,
  SecurityAuditEventKind,
  SecurityAuditSeverity,
} from '@hubblewave/auth-guard';
export { ACCESS_AUDIT_PORT } from '@hubblewave/auth-guard';
export type {
  AccessRuleCacheInvalidationPort,
  CollectionRuleChangeEvent,
  PropertyRuleChangeEvent,
  CacheInvalidationOperation,
} from './lib/cache-invalidation.port';
export { ACCESS_RULE_CACHE_INVALIDATION_PORT } from './lib/cache-invalidation.port';
