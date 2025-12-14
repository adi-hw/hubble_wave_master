# Terminology Migration Guide

This document maps existing database entities and code to the new user-facing terminology.

## Philosophy

**Internal Code**: Keep technical, consistent naming in code
**User-Facing**: Use friendly, modern terminology in UI

This means:
- Database tables stay as `tenant_user`, `business_rule`, etc.
- API endpoints stay as `/api/tenant-users`, `/api/business-rules`
- UI labels show "Users", "Automations", etc.

---

## Entity to UI Label Mapping

### Core Entities

| Entity/Table | Code Reference | UI Label | Plural | Icon |
|--------------|----------------|----------|--------|------|
| `tenant` | `Tenant` | Workspace | Workspaces | 🏢 |
| `tenant_user` | `TenantUser` | User | Users | 👤 |
| `tenant_role` | `TenantRole` | Role | Roles | 🎭 |
| `tenant_group` | `TenantGroup` | Team | Teams | 👥 |
| `table_ui_config` | `TableUiConfig` | Collection | Collections | 📁 |
| `field_ui_config` | `FieldUiConfig` | Property | Properties | 🏷️ |
| `business_rule` | `BusinessRule` | Automation | Automations | ⚡ |
| `workflow_definition` | `WorkflowDefinition` | Flow | Flows | 🔀 |
| `approval_request` | `ApprovalRequest` | Approval | Approvals | ✅ |
| `notification_template` | `NotificationTemplate` | Template | Templates | 📝 |
| `notification_delivery` | `NotificationDelivery` | Notification | Notifications | 🔔 |
| `event_definition` | `EventDefinition` | Event | Events | 📡 |
| `tenant_table_acl` | `TenantTableAcl` | Access Rule | Access Rules | 🔐 |
| `tenant_setting` | `TenantSetting` | Setting | Settings | ⚙️ |
| `form_definition` | `FormDefinition` | Layout | Layouts | 📐 |
| `platform_script` | `PlatformScript` | Helper | Helpers | 🧩 |
| `audit_log` | `AuditLog` | Activity | Activity Log | 📋 |

### Status Values

| Database Value | UI Label | Color |
|----------------|----------|-------|
| `active` | Active | 🟢 Green |
| `inactive` | Inactive | ⚪ Gray |
| `invited` | Invited | 🔵 Blue |
| `pending_activation` | Pending | 🟡 Amber |
| `suspended` | Suspended | 🔴 Red |
| `deleted` | Deleted | ⚫ Dark Gray |
| `draft` | Draft | ⚪ Gray |
| `published` | Published | 🟢 Green |
| `archived` | Archived | ⚫ Dark Gray |

### Operations

| Database Value | UI Label |
|----------------|----------|
| `create` | Create |
| `read` | View |
| `write` | Edit |
| `delete` | Delete |

---

## Navigation & Sections

### Main Navigation

| Route | Internal Name | UI Label |
|-------|---------------|----------|
| `/` | home | Dashboard |
| `/assets` | assets | Assets |
| `/issues` | issues | Issues |
| `/changes` | changes | Changes |
| `/approvals` | approvals | Approvals |
| `/studio` | studio | Studio |
| `/settings` | settings | Settings |

### Studio Sections

| Route | Internal Name | UI Label |
|-------|---------------|----------|
| `/studio/schema` | schema | Schema |
| `/studio/schema/:table` | collection-editor | Collection |
| `/studio/automations` | automations | Automations |
| `/studio/flows` | flows | Flows |
| `/studio/access` | access | Access |
| `/studio/templates` | templates | Templates |
| `/studio/connections` | connections | Connections |
| `/studio/users` | users | Users |
| `/studio/teams` | teams | Teams |
| `/studio/roles` | roles | Roles |

---

## API Endpoint Mapping

| Internal Endpoint | Public API Path | Description |
|-------------------|-----------------|-------------|
| `/api/tenant-users` | `/api/users` | User management |
| `/api/tenant-roles` | `/api/roles` | Role management |
| `/api/tenant-groups` | `/api/teams` | Team management |
| `/api/business-rules` | `/api/automations` | Automation rules |
| `/api/workflows` | `/api/flows` | Workflow definitions |
| `/api/tables` | `/api/collections` | Collection schema |
| `/api/data/:table` | `/api/:collection` | Collection data |

Note: Consider using route aliases to support both internal and public naming.

---

## Component Naming

### React Components

| Current Name | Keep As | UI Renders As |
|--------------|---------|---------------|
| `UsersListPage` | Keep | "Users" |
| `UserDetailPage` | Keep | "User Details" |
| `BusinessRulesListPage` | Keep | "Automations" |
| `BusinessRuleEditorPage` | Keep | "Edit Automation" |
| `WorkflowsListPage` | Keep | "Flows" |
| `WorkflowEditorPage` | Keep | "Flow Builder" |
| `TableListPage` | Rename: `SchemaPage` | "Schema" |
| `FieldsTab` | Rename: `PropertiesTab` | "Properties" |

### Labels in Code

```typescript
// Create a labels constant for UI text
export const labels = {
  // Entities
  workspace: { singular: 'Workspace', plural: 'Workspaces' },
  user: { singular: 'User', plural: 'Users' },
  team: { singular: 'Team', plural: 'Teams' },
  role: { singular: 'Role', plural: 'Roles' },
  collection: { singular: 'Collection', plural: 'Collections' },
  property: { singular: 'Property', plural: 'Properties' },
  automation: { singular: 'Automation', plural: 'Automations' },
  flow: { singular: 'Flow', plural: 'Flows' },
  approval: { singular: 'Approval', plural: 'Approvals' },
  template: { singular: 'Template', plural: 'Templates' },
  accessRule: { singular: 'Access Rule', plural: 'Access Rules' },
  setting: { singular: 'Setting', plural: 'Settings' },
  activity: { singular: 'Activity', plural: 'Activity Log' },

  // Actions
  create: 'Create',
  view: 'View',
  edit: 'Edit',
  delete: 'Delete',
  save: 'Save',
  cancel: 'Cancel',
  search: 'Search',
  filter: 'Filter',
  export: 'Export',
  import: 'Import',

  // Status
  active: 'Active',
  inactive: 'Inactive',
  invited: 'Invited',
  pending: 'Pending',
  suspended: 'Suspended',
  deleted: 'Deleted',
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};
```

---

## Database Column Labels

When displaying database columns in the UI, use this mapping:

### System Columns

| Column | UI Label |
|--------|----------|
| `id` | ID (usually hidden) |
| `created_at` | Created |
| `updated_at` | Last Modified |
| `created_by` | Created By |
| `updated_by` | Modified By |
| `deleted_at` | Deleted |

### Common Columns

| Column | UI Label |
|--------|----------|
| `name` | Name |
| `code` | Code |
| `description` | Description |
| `status` | Status |
| `is_active` | Active |
| `is_enabled` | Enabled |
| `priority` | Priority |
| `category` | Category |
| `type` | Type |

### User-Related Columns

| Column | UI Label |
|--------|----------|
| `display_name` | Name |
| `work_email` | Email |
| `employee_id` | Employee ID |
| `title` | Job Title |
| `department` | Department |
| `location` | Location |
| `manager_id` | Manager |
| `is_tenant_admin` | Admin |

---

## Error Messages

Transform technical errors to user-friendly messages:

| Technical Error | User Message |
|-----------------|--------------|
| `NotFoundException: User not found` | User not found |
| `ConflictException: User exists` | A user with this email already exists |
| `ForbiddenException: Access denied` | You don't have permission to do this |
| `BadRequestException: Invalid token` | This link is invalid or expired |
| `UnauthorizedException` | Please sign in to continue |
| `ValidationError: Required field` | This field is required |
| `ConnectionError` | Unable to connect. Please try again. |

---

## Implementation Checklist

### Phase 1: UI Labels
- [ ] Create `labels.ts` constants file
- [ ] Update page titles and headers
- [ ] Update navigation labels
- [ ] Update button text
- [ ] Update form labels
- [ ] Update error messages

### Phase 2: Route Aliases
- [ ] Add public route aliases for API
- [ ] Update API documentation
- [ ] Keep internal routes working

### Phase 3: Component Rename
- [ ] Rename files that reference old terminology
- [ ] Update imports
- [ ] Update tests

### Phase 4: Documentation
- [ ] Update user-facing documentation
- [ ] Create terminology glossary
- [ ] Update API docs with new terms

---

## Examples

### Before (ServiceNow-style)
```tsx
<h1>Business Rules</h1>
<p>Configure server-side scripts that execute when records are inserted,
   updated, deleted, or queried.</p>
<button>New Business Rule</button>
```

### After (Modern)
```tsx
<h1>Automations</h1>
<p>Set up automatic actions that run when data changes.</p>
<button>+ New Automation</button>
```

---

### Before (Technical)
```tsx
<label>Target Table</label>
<select>
  <option>incident</option>
  <option>change_request</option>
</select>

<label>When to Run</label>
<select>
  <option>before_insert</option>
  <option>after_insert</option>
  <option>before_update</option>
</select>
```

### After (User-friendly)
```tsx
<label>Collection</label>
<select>
  <option>Issues</option>
  <option>Changes</option>
</select>

<label>Trigger</label>
<select>
  <option>When created</option>
  <option>After created</option>
  <option>When updated</option>
</select>
```

---

## AVA Language Guide

AVA should use the new terminology consistently:

| Instead of | AVA says |
|------------|----------|
| "I found 5 records in the incident table" | "I found 5 issues" |
| "The business rule triggered" | "The automation ran" |
| "Workflow is waiting for approval" | "The flow is waiting for approval" |
| "Record updated successfully" | "Updated successfully" |
| "Table acl denies access" | "You don't have access to this" |
| "GlideRecord query returned..." | "I found..." |
| "Check the sys_id" | "Check the ID" |
