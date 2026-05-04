// ============================================================
// Event Bus - Cross-Service Domain Events on Redis Pub/Sub
// ============================================================
//
// Publishes typed domain events (identity.user-role.changed,
// identity.role-permission.changed, identity.group-membership.changed)
// across services so caches that key on those entities can invalidate
// the moment the source of truth changes.
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
  UserRoleChangedPayload,
  RolePermissionChangedPayload,
  GroupMembershipChangedPayload,
} from './lib/event-types';
