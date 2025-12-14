# Hybrid Identity Model - Complete Implementation Plan

## Executive Summary

This document outlines a comprehensive implementation plan for the **Hybrid Identity Model** - a multi-tenant authentication architecture that combines centralized identity management with tenant-scoped user administration. This approach provides the benefits of single sign-on across tenants while giving each tenant full control over their user base.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema Changes](#2-database-schema-changes)
3. [API Endpoints](#3-api-endpoints)
4. [UI Components & Pages](#4-ui-components--pages)
5. [System Properties](#5-system-properties)
6. [Security Considerations](#6-security-considerations)
7. [Migration Strategy](#7-migration-strategy)
8. [Implementation Phases](#8-implementation-phases)

---

## 1. Architecture Overview

### 1.1 Current State

```
┌─────────────────────────────────────────────────────────────────┐
│                         PLATFORM DB                              │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │  user_accounts  │───>│    tenant_user_memberships          │ │
│  │  (identity)     │    │    (tenant access + metadata)       │ │
│  └─────────────────┘    └─────────────────────────────────────┘ │
│           │                           │                          │
│           │         ┌─────────────────┴───────────────────┐     │
│           │         │  RBAC: roles, permissions, groups   │     │
│           │         └─────────────────────────────────────┘     │
└───────────│─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         TENANT DB                                │
│  ┌─────────────────┐                                            │
│  │  user_profile   │  (display data, preferences, denormalized) │
│  └─────────────────┘                                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  RBAC: tenant_roles, tenant_permissions, tenant_groups      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Proposed Hybrid Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLATFORM DB (Identity Plane)                  │
│  ┌─────────────────┐    ┌──────────────────┐                    │
│  │  user_accounts  │    │     tenants      │                    │
│  │  - email (PK)   │    │  - id, name      │                    │
│  │  - password     │    │  - settings      │                    │
│  │  - mfa          │    └──────────────────┘                    │
│  │  - global prefs │                                            │
│  └─────────────────┘                                            │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   SHARED SERVICES                          │  │
│  │  - Password policies (per tenant)                          │  │
│  │  - LDAP/SSO configurations (per tenant)                    │  │
│  │  - Auth events audit log                                   │  │
│  │  - Refresh token management                                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ user_id (foreign key)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TENANT DB (Per-Tenant)                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    tenant_users                              ││
│  │  - id (PK)                                                   ││
│  │  - user_account_id (FK to platform.user_accounts)            ││
│  │  - status (invited/active/inactive/deleted)                  ││
│  │  - employee_id, title, department, manager_id                ││
│  │  - is_tenant_admin                                           ││
│  │  - invited_by, invited_at, activated_at                      ││
│  │  - deactivated_by, deactivated_at, deactivation_reason       ││
│  │  - last_login_at                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │            TENANT RBAC (Full Control)                        ││
│  │  - tenant_roles                                              ││
│  │  - tenant_permissions                                        ││
│  │  - tenant_user_role                                          ││
│  │  - tenant_groups                                             ││
│  │  - tenant_group_member                                       ││
│  │  - tenant_group_role                                         ││
│  │  - tenant_table_acl / tenant_field_acl                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │            USER SETTINGS (Tenant-Scoped)                     ││
│  │  - user_preferences (UI settings, notifications, etc.)       ││
│  │  - user_delegates (delegation of authority)                  ││
│  │  - user_api_keys (tenant-scoped API access)                  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Single Identity** | One email = one `user_accounts` record globally |
| **Multi-Tenant Access** | Same user can belong to multiple tenants via `tenant_users` |
| **Tenant Autonomy** | Tenants fully control their user lifecycle (invite/activate/deactivate) |
| **Centralized Auth** | Password, MFA, SSO handled at platform level |
| **Tenant Isolation** | User data in tenant DB is completely isolated |
| **Audit Trail** | All user lifecycle events logged in both DBs |

---

## 2. Database Schema Changes

### 2.1 Platform DB Changes

#### 2.1.1 Modify `user_accounts` Table

```sql
-- Add columns for enhanced identity management
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS
  avatar_url VARCHAR(500);

ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS
  email_verified BOOLEAN DEFAULT false;

ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS
  email_verified_at TIMESTAMPTZ;

ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS
  last_login_at TIMESTAMPTZ;

ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS
  is_platform_admin BOOLEAN DEFAULT false;

-- Add index for platform admin lookup
CREATE INDEX IF NOT EXISTS idx_user_accounts_platform_admin
  ON user_accounts(is_platform_admin) WHERE is_platform_admin = true;
```

#### 2.1.2 New `user_invitations` Table (Platform-Level)

```sql
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  token VARCHAR(255) NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ NOT NULL,
  invited_by UUID REFERENCES user_accounts(id),
  invitation_type VARCHAR(50) NOT NULL DEFAULT 'email', -- email, ldap_sync, sso_jit
  metadata JSONB DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, accepted, expired, revoked
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_pending_invitation UNIQUE (email, tenant_id, status)
);

CREATE INDEX idx_user_invitations_token ON user_invitations(token);
CREATE INDEX idx_user_invitations_email ON user_invitations(email);
CREATE INDEX idx_user_invitations_tenant ON user_invitations(tenant_id);
```

#### 2.1.3 New `sso_configs` Table

```sql
CREATE TABLE sso_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id), -- NULL = platform-wide
  provider VARCHAR(50) NOT NULL, -- saml, oidc, oauth2
  name VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT false,

  -- SAML fields
  entity_id VARCHAR(500),
  sso_url VARCHAR(500),
  slo_url VARCHAR(500),
  certificate TEXT,

  -- OIDC/OAuth fields
  client_id VARCHAR(255),
  client_secret_encrypted TEXT,
  authorization_url VARCHAR(500),
  token_url VARCHAR(500),
  userinfo_url VARCHAR(500),
  jwks_url VARCHAR(500),
  scopes VARCHAR(255) DEFAULT 'openid profile email',

  -- Attribute mapping
  attribute_mapping JSONB DEFAULT '{
    "email": "email",
    "display_name": "name",
    "first_name": "given_name",
    "last_name": "family_name"
  }',

  -- JIT provisioning settings
  jit_enabled BOOLEAN DEFAULT false,
  jit_default_roles JSONB DEFAULT '[]',
  jit_group_mapping JSONB DEFAULT '{}',

  -- Audit
  created_by UUID REFERENCES user_accounts(id),
  updated_by UUID REFERENCES user_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT unique_sso_per_tenant UNIQUE (tenant_id, provider, name)
);

CREATE INDEX idx_sso_configs_tenant ON sso_configs(tenant_id);
```

#### 2.1.4 Remove Tables (Move to Tenant DB)

```sql
-- These will be deprecated and migrated to tenant_users in tenant DB
-- DROP TABLE tenant_user_memberships; (after migration)

-- Keep for backward compatibility during migration
ALTER TABLE tenant_user_memberships ADD COLUMN IF NOT EXISTS
  migrated_to_tenant_db BOOLEAN DEFAULT false;
```

---

### 2.2 Tenant DB Changes

#### 2.2.1 New `tenant_users` Table (Core)

```sql
CREATE TABLE tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to platform identity (nullable for local-only users if allowed)
  user_account_id UUID, -- FK to platform.user_accounts (cross-db reference)

  -- User status in this tenant
  status VARCHAR(20) NOT NULL DEFAULT 'invited',
  -- Values: invited, pending_activation, active, inactive, suspended, deleted

  -- Employment/Organization data
  employee_id VARCHAR(100),
  title VARCHAR(200),
  department VARCHAR(200),
  location VARCHAR(200),
  cost_center VARCHAR(50),
  manager_id UUID REFERENCES tenant_users(id),

  -- Contact info (can override platform defaults)
  work_email VARCHAR(320),
  work_phone VARCHAR(50),
  mobile_phone VARCHAR(50),

  -- Display preferences
  display_name VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(500),
  locale VARCHAR(20),
  time_zone VARCHAR(50),

  -- Admin flags
  is_tenant_admin BOOLEAN DEFAULT false,

  -- Lifecycle tracking
  invited_by UUID REFERENCES tenant_users(id),
  invited_at TIMESTAMPTZ,
  activation_token VARCHAR(255),
  activation_token_expires_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  activated_by UUID REFERENCES tenant_users(id), -- for admin-activated accounts

  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES tenant_users(id),
  deactivation_reason TEXT,

  suspended_at TIMESTAMPTZ,
  suspended_by UUID REFERENCES tenant_users(id),
  suspension_reason TEXT,
  suspension_expires_at TIMESTAMPTZ,

  last_login_at TIMESTAMPTZ,

  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES tenant_users(id),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_user_account_per_tenant UNIQUE (user_account_id),
  CONSTRAINT unique_employee_id UNIQUE (employee_id)
);

-- Indexes
CREATE INDEX idx_tenant_users_user_account ON tenant_users(user_account_id);
CREATE INDEX idx_tenant_users_status ON tenant_users(status);
CREATE INDEX idx_tenant_users_manager ON tenant_users(manager_id);
CREATE INDEX idx_tenant_users_department ON tenant_users(department);
CREATE INDEX idx_tenant_users_email ON tenant_users(work_email);
CREATE INDEX idx_tenant_users_employee_id ON tenant_users(employee_id);
CREATE INDEX idx_tenant_users_active ON tenant_users(status) WHERE status = 'active';
```

#### 2.2.2 New `user_preferences` Table

```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,

  -- UI Preferences
  theme VARCHAR(20) DEFAULT 'system', -- light, dark, system
  sidebar_collapsed BOOLEAN DEFAULT false,
  default_list_page_size INT DEFAULT 20,
  date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
  time_format VARCHAR(20) DEFAULT 'HH:mm',
  number_format VARCHAR(20) DEFAULT 'en-US',

  -- Notification Preferences
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  in_app_notifications BOOLEAN DEFAULT true,
  notification_digest VARCHAR(20) DEFAULT 'instant', -- instant, hourly, daily, weekly

  -- Module-specific preferences (extensible)
  module_preferences JSONB DEFAULT '{}',

  -- Keyboard shortcuts
  keyboard_shortcuts_enabled BOOLEAN DEFAULT true,
  custom_shortcuts JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_user_preferences UNIQUE (user_id)
);
```

#### 2.2.3 New `user_delegates` Table

```sql
CREATE TABLE user_delegates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
  delegate_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,

  -- Delegation scope
  delegation_type VARCHAR(50) NOT NULL, -- all, approval, specific_module
  module_scope VARCHAR(100), -- NULL = all modules, or specific module name

  -- Time bounds
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ, -- NULL = indefinite

  -- Permissions delegated
  can_approve BOOLEAN DEFAULT true,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,

  -- Audit
  created_by UUID REFERENCES tenant_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES tenant_users(id),

  CONSTRAINT no_self_delegation CHECK (user_id != delegate_id),
  CONSTRAINT valid_date_range CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX idx_user_delegates_user ON user_delegates(user_id);
CREATE INDEX idx_user_delegates_delegate ON user_delegates(delegate_id);
CREATE INDEX idx_user_delegates_active ON user_delegates(user_id, delegate_id)
  WHERE revoked_at IS NULL;
```

#### 2.2.4 New `user_api_keys` Table

```sql
CREATE TABLE user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Key storage (only prefix shown, full key hashed)
  key_prefix VARCHAR(10) NOT NULL, -- e.g., "hw_live_Abc"
  key_hash VARCHAR(255) NOT NULL,

  -- Permissions
  scopes JSONB NOT NULL DEFAULT '["read"]', -- read, write, admin

  -- Rate limiting
  rate_limit_per_minute INT DEFAULT 60,

  -- Expiration
  expires_at TIMESTAMPTZ,

  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  last_used_ip VARCHAR(45),
  usage_count BIGINT DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES tenant_users(id),
  revoke_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_key_name_per_user UNIQUE (user_id, name)
);

CREATE INDEX idx_user_api_keys_user ON user_api_keys(user_id);
CREATE INDEX idx_user_api_keys_prefix ON user_api_keys(key_prefix);
CREATE INDEX idx_user_api_keys_active ON user_api_keys(user_id) WHERE is_active = true;
```

#### 2.2.5 New `user_audit_log` Table

```sql
CREATE TABLE user_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES tenant_users(id),

  action VARCHAR(50) NOT NULL,
  -- Actions: created, invited, activated, deactivated, suspended, unsuspended,
  --          role_assigned, role_removed, group_joined, group_left,
  --          profile_updated, password_reset_requested, api_key_created, etc.

  actor_id UUID REFERENCES tenant_users(id), -- NULL for system actions
  actor_type VARCHAR(20) NOT NULL DEFAULT 'user', -- user, system, api, sync

  target_type VARCHAR(50), -- role, group, permission, profile, etc.
  target_id UUID,
  target_name VARCHAR(255),

  old_value JSONB,
  new_value JSONB,

  ip_address VARCHAR(45),
  user_agent TEXT,
  correlation_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_audit_log_user ON user_audit_log(user_id);
CREATE INDEX idx_user_audit_log_action ON user_audit_log(action);
CREATE INDEX idx_user_audit_log_created ON user_audit_log(created_at DESC);
CREATE INDEX idx_user_audit_log_actor ON user_audit_log(actor_id);
```

#### 2.2.6 Update Existing Tables

```sql
-- Update tenant_user_role to reference tenant_users instead of external ID
ALTER TABLE tenant_user_role
  ADD COLUMN tenant_user_id UUID REFERENCES tenant_users(id);

-- Create migration to populate tenant_user_id from user_id
-- Then drop user_id column

-- Update tenant_group_member similarly
ALTER TABLE tenant_group_member
  ADD COLUMN tenant_user_id UUID REFERENCES tenant_users(id);

-- Update all tables with created_by/updated_by to reference tenant_users
-- user_profile, audit_log, etc.
```

#### 2.2.7 New `tenant_settings` Table

```sql
CREATE TABLE tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,
  value_type VARCHAR(20) NOT NULL DEFAULT 'string', -- string, number, boolean, json

  -- UI metadata
  display_name VARCHAR(200),
  description TEXT,
  ui_component VARCHAR(50), -- text, number, toggle, select, json_editor
  ui_options JSONB DEFAULT '{}', -- options for select, validation rules, etc.

  -- Access control
  requires_admin BOOLEAN DEFAULT true,
  is_sensitive BOOLEAN DEFAULT false, -- mask in UI/logs

  -- Audit
  updated_by UUID REFERENCES tenant_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_tenant_setting UNIQUE (category, key)
);

CREATE INDEX idx_tenant_settings_category ON tenant_settings(category);
```

---

### 2.3 Entity Files to Create/Modify

#### New Entities (Tenant DB)

| Entity | File Path |
|--------|-----------|
| `TenantUser` | `libs/tenant-db/src/lib/entities/tenant-user.entity.ts` |
| `UserPreference` | `libs/tenant-db/src/lib/entities/user-preference.entity.ts` |
| `UserDelegate` | `libs/tenant-db/src/lib/entities/user-delegate.entity.ts` |
| `UserApiKey` | `libs/tenant-db/src/lib/entities/user-api-key.entity.ts` |
| `UserAuditLog` | `libs/tenant-db/src/lib/entities/user-audit-log.entity.ts` |
| `TenantSetting` | `libs/tenant-db/src/lib/entities/tenant-setting.entity.ts` |

#### New Entities (Platform DB)

| Entity | File Path |
|--------|-----------|
| `UserInvitation` | `libs/platform-db/src/lib/entities/user-invitation.entity.ts` |
| `SsoConfig` | `libs/platform-db/src/lib/entities/sso-config.entity.ts` |

#### Modified Entities

| Entity | Changes |
|--------|---------|
| `UserAccount` | Add `avatar_url`, `email_verified`, `is_platform_admin`, `last_login_at` |
| `TenantUserRole` | Add `tenant_user_id`, deprecate `user_id` |
| `TenantGroupMember` | Add `tenant_user_id`, deprecate `user_id` |
| `UserProfile` | Deprecate (migrate to `TenantUser`) |

---

## 3. API Endpoints

### 3.1 User Management Endpoints (svc-identity)

#### 3.1.1 User CRUD

```
POST   /api/identity/users                    # Invite/create user
GET    /api/identity/users                    # List users (with filters)
GET    /api/identity/users/:id                # Get user details
PATCH  /api/identity/users/:id                # Update user profile
DELETE /api/identity/users/:id                # Soft delete user
```

#### 3.1.2 User Lifecycle

```
POST   /api/identity/users/:id/activate       # Activate invited user
POST   /api/identity/users/:id/deactivate     # Deactivate user
POST   /api/identity/users/:id/reactivate     # Reactivate user
POST   /api/identity/users/:id/suspend        # Suspend user (temporary)
POST   /api/identity/users/:id/unsuspend      # Unsuspend user
POST   /api/identity/users/:id/resend-invite  # Resend invitation email
```

#### 3.1.3 User Roles & Groups

```
GET    /api/identity/users/:id/roles          # Get user's roles
POST   /api/identity/users/:id/roles          # Assign role to user
DELETE /api/identity/users/:id/roles/:roleId  # Remove role from user

GET    /api/identity/users/:id/groups         # Get user's groups
POST   /api/identity/users/:id/groups         # Add user to group
DELETE /api/identity/users/:id/groups/:groupId # Remove user from group

GET    /api/identity/users/:id/permissions    # Get effective permissions
```

#### 3.1.4 User Preferences & Settings

```
GET    /api/identity/users/:id/preferences    # Get user preferences
PATCH  /api/identity/users/:id/preferences    # Update user preferences

GET    /api/identity/users/:id/delegates      # Get user's delegates
POST   /api/identity/users/:id/delegates      # Add delegate
DELETE /api/identity/users/:id/delegates/:id  # Remove delegate
```

#### 3.1.5 API Keys

```
GET    /api/identity/users/:id/api-keys       # List user's API keys
POST   /api/identity/users/:id/api-keys       # Create API key
DELETE /api/identity/users/:id/api-keys/:id   # Revoke API key
POST   /api/identity/users/:id/api-keys/:id/rotate # Rotate API key
```

#### 3.1.6 User Audit

```
GET    /api/identity/users/:id/audit          # Get user's audit log
```

#### 3.1.7 Bulk Operations

```
POST   /api/identity/users/bulk/invite        # Bulk invite users
POST   /api/identity/users/bulk/deactivate    # Bulk deactivate
POST   /api/identity/users/bulk/assign-role   # Bulk assign role
POST   /api/identity/users/import             # Import users from CSV
POST   /api/identity/users/export             # Export users to CSV
```

---

### 3.2 Role Management Endpoints

```
GET    /api/identity/roles                    # List roles
POST   /api/identity/roles                    # Create role
GET    /api/identity/roles/:id                # Get role details
PATCH  /api/identity/roles/:id                # Update role
DELETE /api/identity/roles/:id                # Delete role

GET    /api/identity/roles/:id/permissions    # Get role's permissions
POST   /api/identity/roles/:id/permissions    # Add permission to role
DELETE /api/identity/roles/:id/permissions/:permId # Remove permission

GET    /api/identity/roles/:id/users          # Get users with this role
```

---

### 3.3 Group Management Endpoints

```
GET    /api/identity/groups                   # List groups
POST   /api/identity/groups                   # Create group
GET    /api/identity/groups/:id               # Get group details
PATCH  /api/identity/groups/:id               # Update group
DELETE /api/identity/groups/:id               # Delete group

GET    /api/identity/groups/:id/members       # Get group members
POST   /api/identity/groups/:id/members       # Add member to group
DELETE /api/identity/groups/:id/members/:userId # Remove member
PATCH  /api/identity/groups/:id/members/:userId # Update membership (e.g., is_manager)

GET    /api/identity/groups/:id/roles         # Get group's roles
POST   /api/identity/groups/:id/roles         # Assign role to group
DELETE /api/identity/groups/:id/roles/:roleId # Remove role from group
```

---

### 3.4 Permission Management Endpoints

```
GET    /api/identity/permissions              # List all permissions
GET    /api/identity/permissions/categories   # Get permission categories
POST   /api/identity/permissions              # Create custom permission
PATCH  /api/identity/permissions/:id          # Update permission
DELETE /api/identity/permissions/:id          # Delete permission
```

---

### 3.5 SSO/LDAP Configuration Endpoints

```
GET    /api/identity/sso                      # List SSO configurations
POST   /api/identity/sso                      # Create SSO config
GET    /api/identity/sso/:id                  # Get SSO config details
PATCH  /api/identity/sso/:id                  # Update SSO config
DELETE /api/identity/sso/:id                  # Delete SSO config
POST   /api/identity/sso/:id/test             # Test SSO configuration

GET    /api/identity/ldap                     # List LDAP configurations
POST   /api/identity/ldap                     # Create LDAP config
GET    /api/identity/ldap/:id                 # Get LDAP config
PATCH  /api/identity/ldap/:id                 # Update LDAP config
DELETE /api/identity/ldap/:id                 # Delete LDAP config
POST   /api/identity/ldap/:id/test            # Test LDAP connection
POST   /api/identity/ldap/:id/sync            # Trigger LDAP sync
GET    /api/identity/ldap/:id/sync-history    # Get sync history
```

---

### 3.6 Tenant Settings Endpoints

```
GET    /api/identity/settings                 # Get all tenant settings
GET    /api/identity/settings/:category       # Get settings by category
GET    /api/identity/settings/:category/:key  # Get specific setting
PATCH  /api/identity/settings/:category/:key  # Update setting
POST   /api/identity/settings/bulk            # Bulk update settings
```

---

### 3.7 Request/Response DTOs

#### CreateUserDto

```typescript
interface CreateUserDto {
  email: string;                    // Required
  displayName: string;              // Required
  employeeId?: string;
  title?: string;
  department?: string;
  managerId?: string;               // UUID of manager in tenant_users
  workPhone?: string;
  mobilePhone?: string;
  roleIds?: string[];               // Initial role assignments
  groupIds?: string[];              // Initial group memberships
  sendInvitation?: boolean;         // Default: true
  skipEmailVerification?: boolean;  // Admin override, default: false
  metadata?: Record<string, any>;
}
```

#### UserResponseDto

```typescript
interface UserResponseDto {
  id: string;
  userAccountId: string;
  email: string;
  displayName: string;
  status: 'invited' | 'pending_activation' | 'active' | 'inactive' | 'suspended' | 'deleted';

  employeeId?: string;
  title?: string;
  department?: string;
  location?: string;
  manager?: { id: string; displayName: string };

  workEmail?: string;
  workPhone?: string;
  mobilePhone?: string;

  avatarUrl?: string;
  locale?: string;
  timeZone?: string;

  isTenantAdmin: boolean;

  roles: RoleSummaryDto[];
  groups: GroupSummaryDto[];

  invitedAt?: string;
  activatedAt?: string;
  lastLoginAt?: string;

  createdAt: string;
  updatedAt: string;
}
```

#### UserListQueryDto

```typescript
interface UserListQueryDto {
  q?: string;                       // Search query (name, email, employee_id)
  status?: string | string[];       // Filter by status
  department?: string;
  managerId?: string;
  roleId?: string;
  groupId?: string;
  isTenantAdmin?: boolean;

  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';

  includeDeleted?: boolean;         // Admin only
}
```

---

## 4. UI Components & Pages

### 4.1 Page Structure

```
/admin/users                        # User Management Hub
├── /admin/users/list               # User List (with filters, search, bulk actions)
├── /admin/users/new                # Create/Invite User
├── /admin/users/:id                # User Detail View
│   ├── /admin/users/:id/edit       # Edit User Profile
│   ├── /admin/users/:id/roles      # Manage User Roles
│   ├── /admin/users/:id/groups     # Manage User Groups
│   ├── /admin/users/:id/delegates  # Manage Delegates
│   ├── /admin/users/:id/api-keys   # Manage API Keys
│   └── /admin/users/:id/audit      # User Audit Log

/admin/roles                        # Role Management
├── /admin/roles/list               # Role List
├── /admin/roles/new                # Create Role
├── /admin/roles/:id                # Role Detail
│   ├── /admin/roles/:id/edit       # Edit Role
│   └── /admin/roles/:id/permissions # Manage Role Permissions

/admin/groups                       # Group Management
├── /admin/groups/list              # Group List
├── /admin/groups/new               # Create Group
├── /admin/groups/:id               # Group Detail
│   ├── /admin/groups/:id/edit      # Edit Group
│   ├── /admin/groups/:id/members   # Manage Members
│   └── /admin/groups/:id/roles     # Manage Group Roles

/admin/permissions                  # Permission Catalog
├── /admin/permissions/list         # Permission List (by category)
└── /admin/permissions/matrix       # Permission Matrix View

/admin/security                     # Security Settings
├── /admin/security/password-policy # Password Policy Configuration
├── /admin/security/sso             # SSO Configuration
│   └── /admin/security/sso/:id     # SSO Provider Detail
├── /admin/security/ldap            # LDAP Configuration
│   └── /admin/security/ldap/:id    # LDAP Server Detail
└── /admin/security/audit           # Security Audit Log

/admin/settings                     # Tenant Settings
├── /admin/settings/general         # General Settings
├── /admin/settings/security        # Security Settings
├── /admin/settings/notifications   # Notification Settings
└── /admin/settings/integrations    # Integration Settings
```

---

### 4.2 Component Hierarchy

```
apps/web-client/src/features/admin/
├── users/
│   ├── components/
│   │   ├── UserListTable.tsx           # Data table with filters
│   │   ├── UserListFilters.tsx         # Filter sidebar/toolbar
│   │   ├── UserCard.tsx                # User card for grid view
│   │   ├── UserStatusBadge.tsx         # Status indicator
│   │   ├── UserAvatar.tsx              # Avatar with fallback
│   │   ├── UserQuickActions.tsx        # Dropdown actions menu
│   │   ├── UserBulkActions.tsx         # Bulk action toolbar
│   │   ├── InviteUserModal.tsx         # Quick invite modal
│   │   ├── UserProfileForm.tsx         # Edit profile form
│   │   ├── UserRoleAssignment.tsx      # Role management component
│   │   ├── UserGroupAssignment.tsx     # Group management component
│   │   ├── UserDelegateManager.tsx     # Delegate management
│   │   ├── UserApiKeyManager.tsx       # API key management
│   │   ├── UserAuditTimeline.tsx       # Audit log timeline
│   │   ├── UserImportWizard.tsx        # CSV import wizard
│   │   └── OrgChartView.tsx            # Organization hierarchy view
│   ├── pages/
│   │   ├── UserListPage.tsx
│   │   ├── UserCreatePage.tsx
│   │   ├── UserDetailPage.tsx
│   │   └── UserEditPage.tsx
│   ├── hooks/
│   │   ├── useUsers.ts                 # User list query
│   │   ├── useUser.ts                  # Single user query
│   │   ├── useUserMutations.ts         # Create/update/delete
│   │   ├── useUserRoles.ts             # Role assignment
│   │   ├── useUserGroups.ts            # Group assignment
│   │   └── useUserAudit.ts             # Audit log query
│   └── index.ts
│
├── roles/
│   ├── components/
│   │   ├── RoleListTable.tsx
│   │   ├── RoleCard.tsx
│   │   ├── RoleForm.tsx
│   │   ├── PermissionSelector.tsx      # Tree/checkbox permission selector
│   │   ├── RoleUsersPreview.tsx        # Users with this role
│   │   └── RoleInheritanceGraph.tsx    # Visual role hierarchy
│   ├── pages/
│   │   ├── RoleListPage.tsx
│   │   ├── RoleCreatePage.tsx
│   │   └── RoleDetailPage.tsx
│   ├── hooks/
│   │   ├── useRoles.ts
│   │   ├── useRole.ts
│   │   └── useRoleMutations.ts
│   └── index.ts
│
├── groups/
│   ├── components/
│   │   ├── GroupListTable.tsx
│   │   ├── GroupCard.tsx
│   │   ├── GroupForm.tsx
│   │   ├── GroupMemberList.tsx
│   │   ├── MemberAddModal.tsx
│   │   ├── GroupRoleAssignment.tsx
│   │   └── GroupHierarchyTree.tsx      # Nested groups view
│   ├── pages/
│   │   ├── GroupListPage.tsx
│   │   ├── GroupCreatePage.tsx
│   │   └── GroupDetailPage.tsx
│   ├── hooks/
│   │   ├── useGroups.ts
│   │   ├── useGroup.ts
│   │   ├── useGroupMembers.ts
│   │   └── useGroupMutations.ts
│   └── index.ts
│
├── permissions/
│   ├── components/
│   │   ├── PermissionCatalog.tsx       # Categorized permission list
│   │   ├── PermissionMatrix.tsx        # Role x Permission matrix
│   │   └── PermissionSearch.tsx
│   ├── pages/
│   │   └── PermissionListPage.tsx
│   └── hooks/
│       └── usePermissions.ts
│
├── security/
│   ├── components/
│   │   ├── PasswordPolicyForm.tsx
│   │   ├── SsoConfigForm.tsx
│   │   ├── SsoProviderCard.tsx
│   │   ├── LdapConfigForm.tsx
│   │   ├── LdapSyncStatus.tsx
│   │   ├── LdapAttributeMapping.tsx
│   │   └── SecurityAuditLog.tsx
│   ├── pages/
│   │   ├── PasswordPolicyPage.tsx
│   │   ├── SsoListPage.tsx
│   │   ├── SsoDetailPage.tsx
│   │   ├── LdapListPage.tsx
│   │   ├── LdapDetailPage.tsx
│   │   └── SecurityAuditPage.tsx
│   └── hooks/
│       ├── usePasswordPolicy.ts
│       ├── useSsoConfigs.ts
│       └── useLdapConfigs.ts
│
└── settings/
    ├── components/
    │   ├── SettingGroup.tsx            # Group of related settings
    │   ├── SettingField.tsx            # Individual setting input
    │   ├── SettingToggle.tsx
    │   ├── SettingSelect.tsx
    │   └── SettingJson.tsx
    ├── pages/
    │   ├── GeneralSettingsPage.tsx
    │   ├── SecuritySettingsPage.tsx
    │   └── NotificationSettingsPage.tsx
    └── hooks/
        └── useTenantSettings.ts
```

---

### 4.3 Key UI Components Detail

#### 4.3.1 UserListPage

```tsx
// Features:
// - Search by name, email, employee ID
// - Filter by: status, department, role, group, manager
// - Sort by: name, email, status, created_at, last_login
// - View modes: table (default), card grid, org chart
// - Bulk actions: invite, deactivate, assign role, export
// - Quick actions per user: view, edit, deactivate, impersonate

interface UserListPageProps {
  defaultView?: 'table' | 'grid' | 'orgchart';
}
```

#### 4.3.2 UserDetailPage

```tsx
// Tabs:
// - Overview: Profile info, status, quick stats
// - Roles & Permissions: Current roles, effective permissions
// - Groups: Group memberships
// - Delegates: Who can act on behalf
// - API Keys: Personal API keys
// - Activity: Recent actions, audit log

interface UserDetailPageProps {
  userId: string;
  defaultTab?: 'overview' | 'roles' | 'groups' | 'delegates' | 'api-keys' | 'activity';
}
```

#### 4.3.3 InviteUserModal

```tsx
// Streamlined user invitation:
// - Email (required)
// - Display name (required)
// - Department (optional, autocomplete from existing)
// - Role (optional, multi-select)
// - Send invitation email (toggle, default true)
// - Personalized message (optional)

interface InviteUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: UserResponseDto) => void;
  defaultRoleId?: string;
  defaultGroupId?: string;
}
```

#### 4.3.4 PermissionMatrix

```tsx
// Visual matrix showing:
// - Rows: Permissions (grouped by category)
// - Columns: Roles
// - Cells: Checkbox (granted/not granted)
// - Filter by permission category
// - Highlight differences between roles

interface PermissionMatrixProps {
  roleIds?: string[];  // Show specific roles, or all if empty
  categoryFilter?: string;
  onPermissionChange?: (roleId: string, permissionId: string, granted: boolean) => void;
  readOnly?: boolean;
}
```

---

### 4.4 Admin Dashboard Updates

Add new section to `AdminDashboardPage.tsx`:

```typescript
const adminSections: AdminSection[] = [
  // ... existing sections ...
  {
    title: 'User Administration',
    description: 'Manage users, roles, groups, and security settings',
    items: [
      {
        name: 'Users',
        description: 'Manage user accounts and access',
        href: '/admin/users',
        icon: Users,
        color: 'text-blue-600 bg-blue-100',
        darkColor: 'dark:text-blue-400 dark:bg-blue-900/30',
      },
      {
        name: 'Roles',
        description: 'Define roles and permissions',
        href: '/admin/roles',
        icon: Shield,
        color: 'text-purple-600 bg-purple-100',
        darkColor: 'dark:text-purple-400 dark:bg-purple-900/30',
      },
      {
        name: 'Groups',
        description: 'Organize users into groups',
        href: '/admin/groups',
        icon: UsersRound,
        color: 'text-green-600 bg-green-100',
        darkColor: 'dark:text-green-400 dark:bg-green-900/30',
      },
      {
        name: 'Security',
        description: 'SSO, LDAP, and security policies',
        href: '/admin/security',
        icon: Lock,
        color: 'text-red-600 bg-red-100',
        darkColor: 'dark:text-red-400 dark:bg-red-900/30',
      },
    ],
  },
];
```

---

## 5. System Properties

### 5.1 User Management Settings

| Category | Key | Type | Default | Description |
|----------|-----|------|---------|-------------|
| `user` | `allow_self_registration` | boolean | `false` | Allow users to self-register |
| `user` | `require_email_verification` | boolean | `true` | Require email verification for new users |
| `user` | `invitation_expiry_hours` | number | `72` | Hours until invitation link expires |
| `user` | `allow_multiple_sessions` | boolean | `true` | Allow same user to have multiple active sessions |
| `user` | `max_sessions_per_user` | number | `5` | Maximum concurrent sessions per user |
| `user` | `session_timeout_minutes` | number | `480` | Session inactivity timeout (8 hours default) |
| `user` | `require_unique_email_per_tenant` | boolean | `true` | Enforce unique email within tenant |
| `user` | `allow_employee_id_login` | boolean | `false` | Allow login with employee ID instead of email |
| `user` | `default_locale` | string | `'en-US'` | Default locale for new users |
| `user` | `default_timezone` | string | `'UTC'` | Default timezone for new users |
| `user` | `avatar_upload_enabled` | boolean | `true` | Allow users to upload custom avatars |
| `user` | `avatar_max_size_kb` | number | `500` | Maximum avatar file size |

### 5.2 Password Policy Settings

| Category | Key | Type | Default | Description |
|----------|-----|------|---------|-------------|
| `password` | `min_length` | number | `12` | Minimum password length |
| `password` | `require_uppercase` | boolean | `true` | Require uppercase letters |
| `password` | `require_lowercase` | boolean | `true` | Require lowercase letters |
| `password` | `require_numbers` | boolean | `true` | Require numeric digits |
| `password` | `require_symbols` | boolean | `false` | Require special characters |
| `password` | `expiry_days` | number | `0` | Days until password expires (0 = never) |
| `password` | `history_depth` | number | `5` | Number of previous passwords to check |
| `password` | `max_failed_attempts` | number | `5` | Failed attempts before lockout |
| `password` | `lockout_duration_minutes` | number | `15` | Lockout duration after max failures |
| `password` | `allow_password_reset` | boolean | `true` | Allow self-service password reset |
| `password` | `reset_token_expiry_minutes` | number | `60` | Password reset token validity |

### 5.3 MFA Settings

| Category | Key | Type | Default | Description |
|----------|-----|------|---------|-------------|
| `mfa` | `enabled` | boolean | `false` | Enable MFA globally |
| `mfa` | `required_for_all` | boolean | `false` | Require MFA for all users |
| `mfa` | `required_for_admins` | boolean | `true` | Require MFA for tenant admins |
| `mfa` | `allowed_methods` | string[] | `['totp']` | Allowed MFA methods: totp, sms, email, webauthn |
| `mfa` | `totp_issuer_name` | string | `'EAM Platform'` | TOTP authenticator display name |
| `mfa` | `recovery_codes_count` | number | `10` | Number of recovery codes to generate |
| `mfa` | `remember_device_days` | number | `30` | Days to remember trusted device |

### 5.4 SSO Settings

| Category | Key | Type | Default | Description |
|----------|-----|------|---------|-------------|
| `sso` | `enabled` | boolean | `false` | Enable SSO authentication |
| `sso` | `allow_local_login` | boolean | `true` | Allow local login when SSO is enabled |
| `sso` | `force_sso` | boolean | `false` | Force SSO (disable local login) |
| `sso` | `jit_provisioning` | boolean | `true` | Auto-create users on first SSO login |
| `sso` | `jit_default_role` | string | `'user'` | Default role for JIT-provisioned users |
| `sso` | `jit_update_profile` | boolean | `true` | Update profile from SSO on each login |
| `sso` | `logout_redirect_url` | string | `null` | URL to redirect after SSO logout |

### 5.5 LDAP Settings

| Category | Key | Type | Default | Description |
|----------|-----|------|---------|-------------|
| `ldap` | `enabled` | boolean | `false` | Enable LDAP authentication |
| `ldap` | `sync_enabled` | boolean | `false` | Enable periodic LDAP sync |
| `ldap` | `sync_interval_hours` | number | `24` | Hours between LDAP syncs |
| `ldap` | `sync_deactivate_missing` | boolean | `false` | Deactivate users not found in LDAP |
| `ldap` | `sync_update_groups` | boolean | `true` | Sync group memberships from LDAP |
| `ldap` | `fallback_to_local` | boolean | `true` | Fall back to local auth if LDAP fails |

### 5.6 API Key Settings

| Category | Key | Type | Default | Description |
|----------|-----|------|---------|-------------|
| `api_keys` | `enabled` | boolean | `true` | Enable personal API keys |
| `api_keys` | `max_per_user` | number | `5` | Maximum API keys per user |
| `api_keys` | `default_expiry_days` | number | `365` | Default API key expiration |
| `api_keys` | `require_expiry` | boolean | `false` | Require expiration date for API keys |
| `api_keys` | `max_rate_per_minute` | number | `60` | Maximum API requests per minute |

### 5.7 Delegation Settings

| Category | Key | Type | Default | Description |
|----------|-----|------|---------|-------------|
| `delegation` | `enabled` | boolean | `true` | Enable user delegation |
| `delegation` | `max_delegates_per_user` | number | `5` | Maximum delegates per user |
| `delegation` | `require_end_date` | boolean | `false` | Require delegation end date |
| `delegation` | `max_duration_days` | number | `90` | Maximum delegation duration |
| `delegation` | `notify_on_action` | boolean | `true` | Notify user when delegate acts |

### 5.8 Audit Settings

| Category | Key | Type | Default | Description |
|----------|-----|------|---------|-------------|
| `audit` | `retention_days` | number | `365` | Days to retain audit logs |
| `audit` | `log_profile_views` | boolean | `false` | Log when users view profiles |
| `audit` | `log_permission_checks` | boolean | `false` | Log permission check failures |
| `audit` | `export_enabled` | boolean | `true` | Allow audit log export |

---

### 5.9 Settings UI Categories

```typescript
const settingsCategories = [
  {
    id: 'user',
    name: 'User Management',
    icon: Users,
    description: 'Configure user registration, sessions, and defaults',
  },
  {
    id: 'password',
    name: 'Password Policy',
    icon: Key,
    description: 'Set password requirements and lockout rules',
  },
  {
    id: 'mfa',
    name: 'Multi-Factor Authentication',
    icon: Shield,
    description: 'Configure MFA requirements and methods',
  },
  {
    id: 'sso',
    name: 'Single Sign-On',
    icon: LogIn,
    description: 'Configure SSO providers and settings',
  },
  {
    id: 'ldap',
    name: 'LDAP / Active Directory',
    icon: Server,
    description: 'Configure LDAP authentication and sync',
  },
  {
    id: 'api_keys',
    name: 'API Keys',
    icon: KeyRound,
    description: 'Configure personal API key settings',
  },
  {
    id: 'delegation',
    name: 'Delegation',
    icon: UserSwitch,
    description: 'Configure user delegation settings',
  },
  {
    id: 'audit',
    name: 'Audit Logging',
    icon: FileSearch,
    description: 'Configure audit log retention and behavior',
  },
];
```

---

## 6. Security Considerations

### 6.1 Authentication Flow Security

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUTHENTICATION FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User enters credentials (email + password) at tenant login page         │
│     └─► Rate limited: 5 attempts/minute per IP                              │
│                                                                              │
│  2. Validate tenant is active                                                │
│     └─► Reject if tenant suspended/disabled                                  │
│                                                                              │
│  3. Look up user in platform.user_accounts by email                          │
│     └─► Check email_verified if required                                     │
│     └─► Check account status (ACTIVE, not LOCKED/DISABLED)                   │
│                                                                              │
│  4. Validate tenant membership in tenant_db.tenant_users                     │
│     └─► Check status is 'active' (not invited/inactive/suspended)            │
│                                                                              │
│  5. Validate password (argon2id)                                             │
│     └─► On failure: increment failed_attempts, check lockout                 │
│     └─► On lockout: return generic error, log auth event                     │
│                                                                              │
│  6. Check password expiry                                                    │
│     └─► If expired: return password_expired error, require change            │
│                                                                              │
│  7. Check MFA requirement                                                    │
│     └─► If required and not verified: return mfa_required                    │
│     └─► Validate MFA token/code                                              │
│                                                                              │
│  8. Generate tokens                                                          │
│     └─► Access token: JWT with user_id, tenant_id, roles, permissions        │
│     └─► Refresh token: Stored in DB with family tracking                     │
│     └─► Set HttpOnly cookie for refresh token                                │
│                                                                              │
│  9. Log auth event                                                           │
│     └─► Store IP, user_agent, correlation_id, result                         │
│                                                                              │
│  10. Update last_login_at in both user_accounts and tenant_users             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Authorization Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PERMISSION RESOLUTION                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User → Direct Roles ──────────────────────┐                                │
│    │                                        │                                │
│    └─► Groups → Group Roles ───────────────┼─► Aggregate Roles               │
│                                             │           │                    │
│                                             │           ▼                    │
│                                             │    Role Inheritance            │
│                                             │           │                    │
│                                             │           ▼                    │
│                                             └──► All Permissions             │
│                                                                              │
│  Special Overrides:                                                          │
│  ├─► is_platform_admin: Bypass all checks (platform operations)              │
│  ├─► is_tenant_admin: Bypass tenant-level permission checks                  │
│  └─► Delegated permissions: Time-bound, scope-limited                        │
│                                                                              │
│  ACL Evaluation (for data access):                                           │
│  1. Check tenant_table_acl for operation (read/create/write/delete)          │
│  2. If allowed, check tenant_field_acl for field-level access                │
│  3. Apply conditions if defined (ABAC expressions)                           │
│  4. Deny by default if no explicit allow                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Data Isolation

| Layer | Mechanism |
|-------|-----------|
| **Database** | Separate tenant DBs, connection pool per tenant |
| **API** | Tenant resolved from JWT/host, injected into request context |
| **Queries** | All queries scoped to current tenant automatically |
| **Cross-tenant** | Only platform admins via special endpoints |
| **Audit** | All actions logged with tenant_id, user_id, IP |

### 6.4 Sensitive Data Handling

| Data | Storage | Display |
|------|---------|---------|
| **Passwords** | Argon2id hash only, never stored in plain text | Never displayed |
| **MFA secrets** | AES-256 encrypted | Never displayed after setup |
| **API keys** | SHA-256 hash, only prefix stored | Full key shown once at creation |
| **SSO secrets** | AES-256 encrypted | Masked in UI (*****) |
| **LDAP passwords** | AES-256 encrypted | Masked in UI (*****) |
| **Refresh tokens** | SHA-256 hash | Never displayed |
| **Recovery codes** | Bcrypt hash | Shown once at generation |

---

## 7. Migration Strategy

### 7.1 Phase 1: Schema Preparation

```sql
-- 1. Create new tables in tenant DB
CREATE TABLE tenant_users (...);
CREATE TABLE user_preferences (...);
CREATE TABLE user_delegates (...);
CREATE TABLE user_api_keys (...);
CREATE TABLE user_audit_log (...);
CREATE TABLE tenant_settings (...);

-- 2. Create new tables in platform DB
CREATE TABLE user_invitations (...);
CREATE TABLE sso_configs (...);

-- 3. Add migration columns to existing tables
ALTER TABLE tenant_user_role ADD COLUMN tenant_user_id UUID;
ALTER TABLE tenant_group_member ADD COLUMN tenant_user_id UUID;
ALTER TABLE tenant_user_memberships ADD COLUMN migrated_to_tenant_db BOOLEAN DEFAULT false;
```

### 7.2 Phase 2: Data Migration

```typescript
// Migration script pseudocode
async function migrateUsersToTenantDb() {
  const tenants = await platformDb.query('SELECT * FROM tenants WHERE status = $1', ['ACTIVE']);

  for (const tenant of tenants) {
    const tenantDb = await getTenantDbConnection(tenant.id);

    // Get all memberships for this tenant
    const memberships = await platformDb.query(`
      SELECT tum.*, ua.primary_email, ua.display_name
      FROM tenant_user_memberships tum
      JOIN user_accounts ua ON ua.id = tum.user_id
      WHERE tum.tenant_id = $1 AND tum.migrated_to_tenant_db = false
    `, [tenant.id]);

    for (const membership of memberships) {
      // Create tenant_user record
      const tenantUser = await tenantDb.query(`
        INSERT INTO tenant_users (
          user_account_id, status, employee_id, title, department,
          display_name, work_email, is_tenant_admin, activated_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, [
        membership.user_id,
        membership.status === 'ACTIVE' ? 'active' : 'inactive',
        membership.employee_id,
        membership.title,
        membership.department,
        membership.display_name || membership.primary_email.split('@')[0],
        membership.primary_email,
        membership.is_tenant_admin,
        membership.created_at,
        membership.created_at
      ]);

      // Update role assignments to use new tenant_user_id
      await tenantDb.query(`
        UPDATE tenant_user_role
        SET tenant_user_id = $1
        WHERE user_id = $2
      `, [tenantUser.id, membership.user_id]);

      // Update group memberships
      await tenantDb.query(`
        UPDATE tenant_group_member
        SET tenant_user_id = $1
        WHERE user_id = $2
      `, [tenantUser.id, membership.user_id]);

      // Migrate user_profile data to tenant_user if exists
      const profile = await tenantDb.query(`
        SELECT * FROM user_profile WHERE tenant_user_id = $1
      `, [membership.id]);

      if (profile) {
        await tenantDb.query(`
          UPDATE tenant_users
          SET locale = $1, time_zone = $2, phone_number = $3
          WHERE id = $4
        `, [profile.locale, profile.time_zone, profile.phone_number, tenantUser.id]);

        // Create user_preferences from profile.preferences
        await tenantDb.query(`
          INSERT INTO user_preferences (user_id, module_preferences)
          VALUES ($1, $2)
        `, [tenantUser.id, profile.preferences]);
      }

      // Mark as migrated
      await platformDb.query(`
        UPDATE tenant_user_memberships
        SET migrated_to_tenant_db = true
        WHERE id = $1
      `, [membership.id]);
    }
  }
}
```

### 7.3 Phase 3: Code Updates

1. **Update `auth.service.ts`**:
   - Query `tenant_users` instead of `tenant_user_memberships`
   - Check tenant_user status for tenant-level access
   - Update last_login_at in tenant_users

2. **Update role/permission resolution**:
   - Use `tenant_user_id` in tenant_user_role
   - Use `tenant_user_id` in tenant_group_member

3. **Update API endpoints**:
   - New user management endpoints
   - Deprecate old endpoints with 301 redirects

4. **Update frontend**:
   - New user management pages
   - Update user pickers to use new API

### 7.4 Phase 4: Cleanup

```sql
-- After successful migration and verification

-- 1. Drop migration columns
ALTER TABLE tenant_user_role DROP COLUMN user_id;
ALTER TABLE tenant_group_member DROP COLUMN user_id;

-- 2. Drop deprecated tables
DROP TABLE user_profile;
DROP TABLE tenant_user_memberships;

-- 3. Add constraints
ALTER TABLE tenant_user_role
  ADD CONSTRAINT fk_tenant_user_role_user
  FOREIGN KEY (tenant_user_id) REFERENCES tenant_users(id);

ALTER TABLE tenant_group_member
  ADD CONSTRAINT fk_tenant_group_member_user
  FOREIGN KEY (tenant_user_id) REFERENCES tenant_users(id);
```

---

## 8. Implementation Phases

### Phase 1: Foundation (2-3 sprints)

**Backend:**
- [ ] Create new entity files (`TenantUser`, `UserPreference`, etc.)
- [ ] Create database migrations
- [ ] Implement `TenantUserService` with CRUD operations
- [ ] Update `AuthService` to use `tenant_users`
- [ ] Implement user invitation flow
- [ ] Add user lifecycle endpoints (activate, deactivate, suspend)

**Frontend:**
- [ ] Create `UserListPage` with basic table view
- [ ] Create `UserDetailPage` with overview tab
- [ ] Create `InviteUserModal`
- [ ] Add user management to admin navigation

### Phase 2: Role & Group Management (2 sprints)

**Backend:**
- [ ] Implement role management endpoints
- [ ] Implement group management endpoints
- [ ] Update permission resolution to use `tenant_user_id`
- [ ] Add role inheritance support

**Frontend:**
- [ ] Create `RoleListPage` and `RoleDetailPage`
- [ ] Create `GroupListPage` and `GroupDetailPage`
- [ ] Create `PermissionSelector` component
- [ ] Create `UserRoleAssignment` and `UserGroupAssignment` components
- [ ] Add roles/groups tabs to `UserDetailPage`

### Phase 3: Advanced Features (2 sprints)

**Backend:**
- [ ] Implement user delegation endpoints
- [ ] Implement API key management
- [ ] Implement user audit logging
- [ ] Add bulk operations (import, export, bulk assign)

**Frontend:**
- [ ] Create `UserDelegateManager` component
- [ ] Create `UserApiKeyManager` component
- [ ] Create `UserAuditTimeline` component
- [ ] Create `UserImportWizard`
- [ ] Add `OrgChartView` for hierarchy visualization

### Phase 4: Security Features (2 sprints)

**Backend:**
- [ ] Implement SSO configuration endpoints
- [ ] Implement enhanced LDAP sync with groups
- [ ] Add MFA enforcement per role/user
- [ ] Implement security audit endpoints

**Frontend:**
- [ ] Create `SsoConfigForm` and `SsoListPage`
- [ ] Create `LdapConfigForm` and `LdapListPage`
- [ ] Create `PasswordPolicyForm`
- [ ] Create `SecurityAuditLog` view

### Phase 5: Settings & Polish (1-2 sprints)

**Backend:**
- [ ] Implement tenant settings endpoints
- [ ] Add setting validation and defaults
- [ ] Performance optimization (caching, indexes)

**Frontend:**
- [ ] Create settings pages for all categories
- [ ] Add `PermissionMatrix` view
- [ ] Polish UI/UX across all pages
- [ ] Add keyboard shortcuts and accessibility

### Phase 6: Migration & Cleanup (1 sprint)

- [ ] Run data migration on staging
- [ ] Verify data integrity
- [ ] Run data migration on production
- [ ] Remove deprecated code and tables
- [ ] Update documentation

---

## Appendix A: Default Roles

```typescript
const defaultRoles = [
  {
    slug: 'admin',
    name: 'Administrator',
    description: 'Full access to all tenant features',
    isSystem: true,
    permissions: ['*'], // All permissions
  },
  {
    slug: 'user',
    name: 'Standard User',
    description: 'Basic access to assigned modules',
    isSystem: true,
    permissions: [
      'profile.read',
      'profile.update',
      'dashboard.read',
    ],
  },
  {
    slug: 'manager',
    name: 'Manager',
    description: 'Can manage team members and approvals',
    isSystem: true,
    permissions: [
      'users.read',
      'groups.read',
      'approvals.manage',
      'reports.read',
    ],
  },
  {
    slug: 'readonly',
    name: 'Read Only',
    description: 'View-only access',
    isSystem: true,
    permissions: [
      'profile.read',
      'dashboard.read',
    ],
  },
];
```

---

## Appendix B: Permission Categories

```typescript
const permissionCategories = [
  {
    id: 'users',
    name: 'User Management',
    permissions: [
      'users.read',
      'users.create',
      'users.update',
      'users.delete',
      'users.invite',
      'users.activate',
      'users.deactivate',
      'users.impersonate',
    ],
  },
  {
    id: 'roles',
    name: 'Role Management',
    permissions: [
      'roles.read',
      'roles.create',
      'roles.update',
      'roles.delete',
      'roles.assign',
    ],
  },
  {
    id: 'groups',
    name: 'Group Management',
    permissions: [
      'groups.read',
      'groups.create',
      'groups.update',
      'groups.delete',
      'groups.manage_members',
    ],
  },
  {
    id: 'security',
    name: 'Security Settings',
    permissions: [
      'security.password_policy',
      'security.sso_config',
      'security.ldap_config',
      'security.mfa_config',
      'security.audit_logs',
    ],
  },
  {
    id: 'settings',
    name: 'Tenant Settings',
    permissions: [
      'settings.read',
      'settings.update',
    ],
  },
  // ... module-specific permissions
];
```

---

## Appendix C: API Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `USER_NOT_FOUND` | 404 | User does not exist |
| `USER_ALREADY_EXISTS` | 409 | User with this email already exists in tenant |
| `USER_INACTIVE` | 403 | User account is inactive |
| `USER_SUSPENDED` | 403 | User account is suspended |
| `USER_LOCKED` | 403 | User account is locked due to failed attempts |
| `INVITATION_EXPIRED` | 400 | Invitation link has expired |
| `INVITATION_ALREADY_ACCEPTED` | 400 | Invitation was already accepted |
| `INVALID_ACTIVATION_TOKEN` | 400 | Activation token is invalid |
| `PASSWORD_POLICY_VIOLATION` | 400 | Password does not meet policy requirements |
| `PASSWORD_RECENTLY_USED` | 400 | Password was used recently |
| `MFA_REQUIRED` | 403 | MFA verification required |
| `MFA_INVALID` | 401 | MFA code is invalid |
| `ROLE_NOT_FOUND` | 404 | Role does not exist |
| `GROUP_NOT_FOUND` | 404 | Group does not exist |
| `PERMISSION_DENIED` | 403 | User lacks required permission |
| `SELF_DEACTIVATION` | 400 | Cannot deactivate own account |
| `LAST_ADMIN` | 400 | Cannot remove last tenant admin |

---

*Document Version: 1.0*
*Last Updated: 2024-12-13*
*Author: Claude (AI Assistant)*
