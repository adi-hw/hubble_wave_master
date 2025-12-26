// ============================================================
// Control Plane Database Entities
// ============================================================
// 
// These entities are for the Control Plane database (eam_control)
// which is managed by HubbleWave internally.
//
// This database tracks:
// - Customer organizations
// - Deployed instances (NOT tenants!)
// - Subscriptions and billing
// - Licenses
// - HubbleWave staff users
// - Administrative audit logs
// - Instance metrics (time-series)
//
// NOTE: There is NO "Platform DB" - that concept doesn't exist in
// the single-instance-per-customer architecture!
// ============================================================

export { Customer, CustomerStatus, CustomerTier } from './customer.entity';
export { Instance, InstanceEnvironment, InstanceStatus, InstanceHealth, ResourceTier } from './instance.entity';
export { Subscription, SubscriptionStatus, BillingCycle } from './subscription.entity';
export { License, LicenseType } from './license.entity';
export { ControlPlaneUser, ControlPlaneRole, ControlPlaneUserStatus } from './control-plane-user.entity';
export { ControlPlaneAuditLog } from './control-plane-audit-log.entity';
export { InstanceMetrics } from './instance-metrics.entity';

// ============================================================
// Entity Array for TypeORM Configuration
// ============================================================

import { Customer } from './customer.entity';
import { Instance } from './instance.entity';
import { Subscription } from './subscription.entity';
import { License } from './license.entity';
import { ControlPlaneUser } from './control-plane-user.entity';
import { ControlPlaneAuditLog } from './control-plane-audit-log.entity';
import { InstanceMetrics } from './instance-metrics.entity';

export const controlPlaneEntities = [
  Customer,
  Instance,
  Subscription,
  License,
  ControlPlaneUser,
  ControlPlaneAuditLog,
  InstanceMetrics,
];
