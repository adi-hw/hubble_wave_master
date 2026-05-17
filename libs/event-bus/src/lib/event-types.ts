/**
 * Cross-service domain event topics carried over Redis pub/sub.
 *
 * W2 Stream 1 PR2 (F025) collapsed the pre-W2 per-entity topics
 * (`identity.user-role.changed`, `identity.role-permission.changed`,
 * `identity.group-membership.changed`) into a single unified invalidation
 * channel — every consumer cache (IdentityResolverAdapter Redis cache,
 * PermissionResolverService in-process cache, AuthorizationService ACL-rule
 * cache) listens on the same channel and routes by the `scope`
 * discriminator. One channel, one payload shape, exactly one obvious way to
 * trigger an invalidation per canon §2.
 *
 * Payloads carry only the IDs of the affected entities; consumers expand
 * those IDs into whatever cached state they own.
 */
export const EventTopic = {
  /**
   * Permission/identity/ACL state changed somewhere. Consumers route on
   * `payload.scope` ('identity' / 'permissions' / 'acl') and the per-scope
   * ID arrays to decide which cache entries to evict.
   *
   * Wire name: `permission.invalidate`. The channel is consumed by:
   *   - `IdentityResolverAdapter` — evicts the Redis identity cache.
   *   - `PermissionResolverService` — evicts the in-process permission cache.
   *   - `AuthorizationService` — evicts the ACL-rule cache on `scope=acl`.
   */
  PermissionInvalidate: 'permission.invalidate',
} as const;

export type EventTopicValue = (typeof EventTopic)[keyof typeof EventTopic];

/**
 * The unified invalidation scope discriminator. Routes consumers to the
 * cache layer(s) they own.
 *
 *  - `identity`    — user → role / user → group mapping changed
 *                    (UserRole, GroupMember mutations).
 *  - `permissions` — role → permission mapping or the role itself changed
 *                    (Role, RolePermission, GroupRole mutations).
 *  - `acl`         — record-level / field-level rule changed
 *                    (CollectionAccessRule, PropertyAccessRule mutations).
 */
export type PermissionInvalidateScope = 'identity' | 'permissions' | 'acl';

/**
 * Payload published on the unified `permission.invalidate` channel. Every
 * field except `scope` is optional; consumers narrow by `scope` first and
 * then read the relevant ID array.
 *
 * Singular-entity changes still publish arrays of length 1 — keeps the
 * wire format flat for batch operations that group N mutations into one
 * event.
 */
export interface PermissionInvalidatePayload {
  scope: PermissionInvalidateScope;
  /** identity scope — users whose role/group membership changed. */
  userIds?: string[];
  /** identity / permissions scope — roles whose membership or perms changed. */
  roleIds?: string[];
  /** identity scope — groups whose membership changed. */
  groupIds?: string[];
  /** acl scope — collections whose access rules changed. */
  collectionIds?: string[];
  /** acl scope — properties whose access rules changed. */
  propertyIds?: string[];
}

/**
 * Compile-time mapping from topic to payload type. Subscribers that use the
 * typed `EventBusService.publish<EventPayloadFor<...>>(...)` form get full
 * inference on payload shape.
 */
export type EventPayloadFor<T extends EventTopicValue> =
  T extends typeof EventTopic.PermissionInvalidate
    ? PermissionInvalidatePayload
    : never;
