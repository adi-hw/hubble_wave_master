/**
 * Cross-service domain event topics carried over Redis pub/sub.
 *
 * Topics are namespaced by domain (`identity.*`, `metadata.*`, ...). Payloads
 * carry only the IDs of the affected entities; subscribers fan out to whatever
 * cached state they own.
 *
 * Conventions:
 * - Past tense ("changed", "removed") — events describe what already happened.
 * - Payloads are minimal: a list of affected IDs is enough for subscribers to
 *   recompute or invalidate. Avoid embedding full entity snapshots.
 */
export const EventTopic = {
  /** A user gained or lost a role assignment. */
  IdentityUserRoleChanged: 'identity.user-role.changed',
  /** A role's permission set changed (affects every user holding the role). */
  IdentityRolePermissionChanged: 'identity.role-permission.changed',
  /** A user joined or left a group (affects roles inherited via the group). */
  IdentityGroupMembershipChanged: 'identity.group-membership.changed',
} as const;

export type EventTopicValue = (typeof EventTopic)[keyof typeof EventTopic];

/**
 * Payload published when a user's direct role assignment changes.
 *
 * `roleIds` is optional context (which role(s) changed) — subscribers that
 * key by user only need `userIds`.
 */
export interface UserRoleChangedPayload {
  userIds: string[];
  roleIds?: string[];
}

/**
 * Payload published when permissions on a role change. Subscribers must fan
 * out to every user who holds the affected role(s).
 */
export interface RolePermissionChangedPayload {
  roleIds: string[];
}

/**
 * Payload published when a user joined or left a group. The group's roles
 * (and therefore the user's effective permissions) may have changed.
 */
export interface GroupMembershipChangedPayload {
  userIds: string[];
  groupIds?: string[];
}

/**
 * Compile-time mapping from topic to payload type. Subscribers that use the
 * typed `EventBusService.publish<EventPayloadFor<...>>(...)` form get full
 * inference on payload shape.
 */
export type EventPayloadFor<T extends EventTopicValue> =
  T extends typeof EventTopic.IdentityUserRoleChanged
    ? UserRoleChangedPayload
    : T extends typeof EventTopic.IdentityRolePermissionChanged
    ? RolePermissionChangedPayload
    : T extends typeof EventTopic.IdentityGroupMembershipChanged
    ? GroupMembershipChangedPayload
    : never;
