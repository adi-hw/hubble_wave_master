export * from './lib/tenant-db.module';
export * from './lib/tenant-db.service';
export * from './lib/tenant-resolve.middleware';
export * from './lib/tenant-host.util';

// Core entities
export * from './lib/entities/workflow-definition.entity';
export * from './lib/entities/form-definition.entity';
export * from './lib/entities/module.entity';
export * from './lib/entities/audit-log.entity';
export * from './lib/entities/form-version.entity';
export * from './lib/entities/workflow-run.entity';
export * from './lib/entities/user-profile.entity';

// Tenant User Management entities
export * from './lib/entities/tenant-user.entity';
export * from './lib/entities/user-preference.entity';
export * from './lib/entities/user-delegate.entity';
export * from './lib/entities/user-api-key.entity';
export * from './lib/entities/user-audit-log.entity';
export * from './lib/entities/tenant-setting.entity';

// Platform configuration entities
export * from './lib/entities/platform-config.entity';
export * from './lib/entities/tenant-customization.entity';
export * from './lib/entities/config-change-history.entity';
export * from './lib/entities/upgrade-manifest.entity';
export * from './lib/entities/tenant-upgrade-impact.entity';
export * from './lib/entities/shared-types';
export * from './lib/entities/business-rule.entity';

// Script entities
export * from './lib/entities/platform-script.entity';
export * from './lib/entities/script-execution-log.entity';

// Workflow entities
export * from './lib/entities/workflow-step-type.entity';
export * from './lib/entities/workflow-step-execution.entity';

// Approval entities
export * from './lib/entities/approval-type.entity';
export * from './lib/entities/approval-request.entity';
export * from './lib/entities/approval-assignment.entity';
export * from './lib/entities/approval-history.entity';

// Notification entities
export * from './lib/entities/notification-channel.entity';
export * from './lib/entities/notification-template.entity';
export * from './lib/entities/notification-subscription.entity';
export * from './lib/entities/notification-delivery.entity';
export * from './lib/entities/in-app-notification.entity';

// Event entities
export * from './lib/entities/event-definition.entity';
export * from './lib/entities/event-log.entity';
export * from './lib/entities/event-subscription.entity';
export * from './lib/entities/event-delivery.entity';

// Tenant RBAC entities (tenant-scoped roles, permissions, groups)
export * from './lib/entities/tenant-role.entity';
export * from './lib/entities/tenant-permission.entity';
export * from './lib/entities/tenant-role-permission.entity';
export * from './lib/entities/tenant-user-role.entity';
export * from './lib/entities/tenant-group.entity';
export * from './lib/entities/tenant-group-member.entity';
export * from './lib/entities/tenant-group-role.entity';

// Tenant navigation entities
export * from './lib/entities/tenant-nav-profile.entity';
export * from './lib/entities/tenant-nav-profile-item.entity';
export * from './lib/entities/application.entity';
export * from './lib/entities/nav-template.entity';
export * from './lib/entities/nav-patch.entity';

// Tenant ACL entities
export * from './lib/entities/tenant-table-acl.entity';
export * from './lib/entities/tenant-field-acl.entity';

// Database-first UI configuration entities
export * from './lib/entities/table-ui-config.entity';
export * from './lib/entities/field-ui-config.entity';

// Schema Engine entities (Collections & Properties)
export * from './lib/entities/collection-definition.entity';
export * from './lib/entities/property-definition.entity';
export * from './lib/entities/property-type.entity';
export * from './lib/entities/collection-relationship.entity';
export * from './lib/entities/property-dependency.entity';

// Views Engine entities
export * from './lib/entities/view-definition.entity';
export * from './lib/entities/view-column.entity';
export * from './lib/entities/form-layout.entity';
export * from './lib/entities/saved-filter.entity';
export * from './lib/entities/user-view-preference.entity';

// Application Modules & Analytics entities
export * from './lib/entities/application-module.entity';

// Service Portal & Self-Service entities
export * from './lib/entities/service-catalog.entity';

// Enterprise SSO entities
export * from './lib/entities/sso-config.entity';

// Enterprise Audit entities
export * from './lib/entities/audit-config.entity';

// Enterprise Compliance entities
export * from './lib/entities/compliance.entity';

// Commitment Engine entities (SLA/OLA)
export * from './lib/entities/commitment.entity';

// Import/Export and Connections entities
export * from './lib/entities/import-export.entity';

// AVA Governance entities
export * from './lib/entities/ava-audit.entity';

export { tenantEntities, platformEntities } from './lib/tenant-db.service';

// Utilities
export * from './lib/utils/config-checksum.util';
