// Instance Database Library
// Customer instance database - each customer has their own isolated database

export * from './lib/entities/index';
export * from './lib/utils';
export * from './lib/audit-log-hash';
export { withAudit } from './lib/audit/with-audit';
export type { AuditEvent, AuditRecorder } from './lib/audit/with-audit';
export { InstanceDbModule } from './lib/instance-db.module';
export { InstanceDbService, TenantDbService } from './lib/instance-db.service';
export {
  IdentityCacheInvalidationSubscriber,
  IdentityCacheEventPublisher,
} from './lib/subscribers/identity-cache-invalidation.subscriber';
export { AccessRuleCacheInvalidationSubscriber } from './lib/subscribers/access-rule-cache-invalidation.subscriber';
export type {
  AccessRuleCacheInvalidationPublisher,
  CollectionRuleChangeEvent as InstanceDbCollectionRuleChangeEvent,
  PropertyRuleChangeEvent as InstanceDbPropertyRuleChangeEvent,
  CacheInvalidationOperation as InstanceDbCacheInvalidationOperation,
} from './lib/subscribers/access-rule-cache-invalidation.subscriber';
export { RuntimeAnomalyService } from './lib/runtime-anomaly/runtime-anomaly.service';
export type { RuntimeAnomalyEvent } from './lib/runtime-anomaly/runtime-anomaly.service';
export { RuntimeAnomalyModule } from './lib/runtime-anomaly/runtime-anomaly.module';
export {
  AvaProposalService,
  BadStateTransitionException,
} from './lib/ava-proposal';
