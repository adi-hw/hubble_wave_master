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

export { Customer, CustomerStatus, CustomerTier, CustomerSettings } from './customer.entity';
export { Instance, InstanceEnvironment, InstanceStatus, InstanceHealth, ResourceTier } from './instance.entity';
export { Subscription, SubscriptionStatus, BillingCycle } from './subscription.entity';
export { License, LicenseType, LicenseStatus } from './license.entity';
export { PackRegistry, PackRelease } from './pack.entity';
export { ControlPlaneUser, ControlPlaneRole, ControlPlaneUserStatus } from './control-plane-user.entity';
export { ControlPlaneAuditLog } from './control-plane-audit-log.entity';        
export { InstanceMetrics } from './instance-metrics.entity';
export { TerraformJob, TerraformJobStatus, TerraformOperation, TerraformOutputLine, TerraformPlan, TerraformResourceChange } from './terraform-job.entity';     
export { GlobalSettings } from './global-settings.entity';

// ============================================================
// Entity Array for TypeORM Configuration
// ============================================================

import { Customer } from './customer.entity';
import { Instance } from './instance.entity';
import { Subscription } from './subscription.entity';
import { License } from './license.entity';
import { PackRegistry, PackRelease } from './pack.entity';
import { ControlPlaneUser } from './control-plane-user.entity';
import { ControlPlaneAuditLog } from './control-plane-audit-log.entity';        
import { InstanceMetrics } from './instance-metrics.entity';
import { TerraformJob } from './terraform-job.entity';
import { GlobalSettings } from './global-settings.entity';

export const controlPlaneEntities = [
  Customer,
  Instance,
  Subscription,
  License,
  PackRegistry,
  PackRelease,
  ControlPlaneUser,
  ControlPlaneAuditLog,
  InstanceMetrics,
  TerraformJob,
  GlobalSettings,
];
