// ============================================================
// Event Bus - Cross-Service Domain Events on Redis Pub/Sub
// ============================================================
//
// Publishes the typed `permission.invalidate` event so every consumer
// cache (IdentityResolverAdapter Redis cache, PermissionResolverService
// in-process cache, AuthorizationService ACL-rule cache) can drop the
// affected entries the moment the source of truth changes (W2 Stream 1
// PR2 / F025). The pre-W2 per-entity topics (user-role / role-permission /
// group-membership) were unified into one channel with a `scope`
// discriminator.
// ============================================================

export { EventBusModule } from './lib/event-bus.module';
export { EventBusService } from './lib/event-bus.service';
export {
  EVENT_BUS_PUBLISHER,
  EVENT_BUS_SUBSCRIBER,
  EVENT_BUS_CHANNEL_PREFIX,
  DEFAULT_EVENT_BUS_CHANNEL_PREFIX,
} from './lib/event-bus.constants';
export {
  EventTopic,
  EventTopicValue,
  EventPayloadFor,
  PermissionInvalidatePayload,
  PermissionInvalidateScope,
} from './lib/event-types';
