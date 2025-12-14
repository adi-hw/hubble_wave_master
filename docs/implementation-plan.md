# HubbleWave Implementation Plan

## Executive Summary

This document provides a systematic, production-ready implementation plan for the HubbleWave platform. The plan is organized into phases, with each phase broken into sprints containing specific tasks.

**Total Estimated Phases**: 7
**Approach**: Incremental, each phase delivers working functionality

---

## Pre-Implementation: Codebase Cleanup

Before starting new development, clean up the repository.

### Cleanup Tasks

#### 1. Remove Deleted Files from Git
```bash
# Files marked as deleted in git status
git rm apps/svc-data/src/app/app.service.ts
git rm apps/svc-identity/src/app/app.service.ts
git rm apps/svc-metadata/src/app/health.controller.ts
git rm apps/svc-metadata/src/app/metadata.service.ts
git rm apps/svc-metadata/src/app/workflow.controller.ts
git rm apps/svc-metadata/src/app/workflow.service.ts
git rm apps/web-client/src/components/ChoiceEditor.tsx
git rm apps/web-client/src/components/FieldTemplateSelector.tsx
git rm apps/web-client/src/components/ValidationRulesEditor.tsx
git rm apps/web-client/src/components/layout/ModulesDrawerV2.tsx
git rm apps/web-client/src/components/layout/SidebarDock.tsx
git rm apps/web-client/src/context/AuthContext.tsx
git rm apps/web-client/src/features/admin/components/DiffViewer.tsx
git rm apps/web-client/src/features/data/FormPage.tsx
git rm apps/web-client/src/features/data/TablePage.tsx
git rm apps/web-client/src/layout/CommandPalette.tsx
git rm apps/web-client/src/layouts/DashboardLayout.tsx
git rm apps/web-client/src/pages/FieldManagerPage.tsx
git rm apps/web-client/src/pages/Forms.tsx
```

#### 2. Remove Deprecated Migrations
```bash
# Old SQL migrations that are now TypeORM migrations
git rm migrations/2025-11-29_add_rbac_abac_config.sql
git rm migrations/2025-11-30_add_forms_workflows.sql
git rm migrations/2025-11-30_add_modules.sql
git rm migrations/2025-11-30_seed-modules.sql
git rm migrations/2025-12-01_add_ui_tables.sql
git rm migrations/2025-12-02_add_model_tables.sql
git rm migrations/2025-12-03_fix-user-role-assignments.sql
```

#### 3. Remove Deprecated Tools
```bash
git rm tools/generate-types.js
git rm tools/seed-acme.js
```

#### 4. Remove Deprecated Entity Files
```bash
# These are marked as deleted
git rm libs/tenant-db/src/lib/entities/field-protection-rule.entity.ts
git rm libs/tenant-db/src/lib/entities/model-field-type.entity.ts
git rm libs/tenant-db/src/lib/entities/model-field.entity.ts
git rm libs/tenant-db/src/lib/entities/model-form-layout.entity.ts
git rm libs/tenant-db/src/lib/entities/model-table.entity.ts
git rm libs/tenant-db/src/lib/entities/user-layout-preference.entity.ts
```

#### 5. Update Exports
- [ ] Update `libs/tenant-db/src/index.ts` to remove deleted entity exports
- [ ] Update `libs/platform-db/src/index.ts` to add new entity exports
- [ ] Verify all module imports are correct

#### 6. Commit Cleanup
```bash
git add -A
git commit -m "chore: cleanup deprecated files and align with HubbleWave design"
```

---

## Phase 0: Foundation Setup

**Goal**: Establish core infrastructure, theming, and mobile-responsive base.

### Sprint 0.1: Design System & Theme

#### 0.1.1 Create HubbleWave CSS Variables
**File**: `apps/web-client/src/styles/hubblewave-theme.css`

```css
:root {
  /* Brand Colors */
  --hw-primary: #4F46E5;
  --hw-primary-hover: #4338CA;
  --hw-primary-light: #818CF8;
  --hw-primary-dark: #3730A3;

  --hw-secondary: #06B6D4;
  --hw-secondary-hover: #0891B2;

  /* Semantic Colors */
  --hw-success: #10B981;
  --hw-warning: #F59E0B;
  --hw-error: #EF4444;
  --hw-info: #3B82F6;

  /* Light Mode */
  --hw-bg: #F8FAFC;
  --hw-bg-subtle: #F1F5F9;
  --hw-surface: #FFFFFF;
  --hw-surface-hover: #F8FAFC;
  --hw-border: #E2E8F0;
  --hw-border-strong: #CBD5E1;
  --hw-text: #0F172A;
  --hw-text-secondary: #475569;
  --hw-text-muted: #94A3B8;

  /* Spacing */
  --hw-space-1: 0.25rem;
  --hw-space-2: 0.5rem;
  --hw-space-3: 0.75rem;
  --hw-space-4: 1rem;
  --hw-space-5: 1.25rem;
  --hw-space-6: 1.5rem;
  --hw-space-8: 2rem;
  --hw-space-10: 2.5rem;
  --hw-space-12: 3rem;

  /* Border Radius */
  --hw-radius-sm: 0.375rem;
  --hw-radius-md: 0.5rem;
  --hw-radius-lg: 0.75rem;
  --hw-radius-xl: 1rem;
  --hw-radius-full: 9999px;

  /* Typography */
  --hw-font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --hw-font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Shadows */
  --hw-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --hw-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --hw-shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);

  /* Transitions */
  --hw-transition-fast: 150ms ease;
  --hw-transition-normal: 200ms ease;
}

.dark {
  --hw-bg: #0F172A;
  --hw-bg-subtle: #1E293B;
  --hw-surface: #1E293B;
  --hw-surface-hover: #334155;
  --hw-border: #334155;
  --hw-border-strong: #475569;
  --hw-text: #F8FAFC;
  --hw-text-secondary: #CBD5E1;
  --hw-text-muted: #64748B;
}
```

**Tasks**:
- [ ] Create `hubblewave-theme.css`
- [ ] Update `tailwind.config.js` to use CSS variables
- [ ] Create theme context with system/light/dark modes
- [ ] Add theme toggle component
- [ ] Test dark mode across all existing components

#### 0.1.2 Mobile-Responsive Layout System
**Files to modify**:
- `apps/web-client/src/components/layout/AppShell.tsx`

**Tasks**:
- [ ] Implement responsive sidebar (collapsible on mobile)
- [ ] Add bottom navigation bar for mobile
- [ ] Create responsive breakpoint hooks
- [ ] Test on mobile viewport sizes
- [ ] Add touch-friendly tap targets (min 44px)

#### 0.1.3 Typography & Base Components
**Tasks**:
- [ ] Create typography components (Heading, Text, Label)
- [ ] Update Button component with HubbleWave styling
- [ ] Update Input component with HubbleWave styling
- [ ] Update Card component
- [ ] Create Badge component with semantic colors
- [ ] Create Avatar component
- [ ] Create Tooltip component

### Sprint 0.2: Labels & Internationalization

#### 0.2.1 Create Labels System
**File**: `apps/web-client/src/lib/labels.ts`

```typescript
export const labels = {
  // Navigation
  nav: {
    home: 'Home',
    dashboard: 'Dashboard',
    studio: 'Studio',
    settings: 'Settings',
  },

  // Entities
  entities: {
    collection: { singular: 'Collection', plural: 'Collections' },
    property: { singular: 'Property', plural: 'Properties' },
    user: { singular: 'User', plural: 'Users' },
    team: { singular: 'Team', plural: 'Teams' },
    role: { singular: 'Role', plural: 'Roles' },
    automation: { singular: 'Automation', plural: 'Automations' },
    flow: { singular: 'Flow', plural: 'Flows' },
    commitment: { singular: 'Commitment', plural: 'Commitments' },
  },

  // Actions
  actions: {
    create: 'Create',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    view: 'View',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    import: 'Import',
  },

  // Status
  status: {
    active: 'Active',
    inactive: 'Inactive',
    invited: 'Invited',
    pending: 'Pending',
    suspended: 'Suspended',
  },
};
```

**Tasks**:
- [ ] Create labels.ts with all platform terminology
- [ ] Create useLabels hook
- [ ] Update all hardcoded strings in components
- [ ] Add support for future i18n

### Sprint 0.3: Core UI Components

#### 0.3.1 Modern Data Table
**File**: `apps/web-client/src/components/ui/DataGrid.tsx`

**Features**:
- [ ] Column resizing (drag handles)
- [ ] Column reordering (drag and drop)
- [ ] Column visibility toggle
- [ ] Sticky header
- [ ] Virtual scrolling for large datasets
- [ ] Row selection (single and multi)
- [ ] Inline editing
- [ ] Responsive mobile view (cards on small screens)
- [ ] Loading skeleton
- [ ] Empty state

#### 0.3.2 Command Palette (Spotlight)
**File**: `apps/web-client/src/components/ui/Spotlight.tsx`

**Features**:
- [ ] Cmd+K / Ctrl+K activation
- [ ] Recent items section
- [ ] Quick actions section
- [ ] Collection search
- [ ] Navigation shortcuts
- [ ] Fuzzy search matching
- [ ] Keyboard navigation
- [ ] Mobile-friendly full-screen mode

#### 0.3.3 Modern Modal System
**File**: `apps/web-client/src/components/ui/Modal.tsx`

**Features**:
- [ ] Slide-in panels (right drawer)
- [ ] Center modals
- [ ] Full-screen modals (mobile)
- [ ] Nested modals support
- [ ] Focus trap
- [ ] Escape to close
- [ ] Click outside to close (configurable)
- [ ] Animation transitions

---

## Phase 1: Schema Engine

**Goal**: Collection and Property management with database-first approach.

### Sprint 1.1: Collection Management

#### 1.1.1 Database Schema
**File**: `migrations/tenant/1787000000000-collection-schema.ts`

```typescript
export class CollectionSchema1787000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // collection_definition table
    await queryRunner.query(`
      CREATE TABLE collection_definition (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(100) NOT NULL UNIQUE,
        label VARCHAR(200) NOT NULL,
        label_plural VARCHAR(200),
        description TEXT,
        icon VARCHAR(50),
        color VARCHAR(20),
        storage_table VARCHAR(100) NOT NULL,
        storage_schema VARCHAR(50) DEFAULT 'public',
        is_extensible BOOLEAN DEFAULT true,
        supports_attachments BOOLEAN DEFAULT true,
        supports_comments BOOLEAN DEFAULT true,
        supports_history BOOLEAN DEFAULT true,
        parent_collection_id UUID REFERENCES collection_definition(id),
        category VARCHAR(50) DEFAULT 'custom',
        is_system BOOLEAN DEFAULT false,
        is_hidden BOOLEAN DEFAULT false,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX idx_collection_code ON collection_definition(code)`);
    await queryRunner.query(`CREATE INDEX idx_collection_category ON collection_definition(category)`);
  }
}
```

**Tasks**:
- [ ] Create migration file
- [ ] Create `CollectionDefinition` entity
- [ ] Update tenant-db index exports
- [ ] Run migration and test

#### 1.1.2 Collection Entity
**File**: `libs/tenant-db/src/lib/entities/collection-definition.entity.ts`

**Tasks**:
- [ ] Create entity with all fields
- [ ] Add TypeORM decorators
- [ ] Add validation decorators
- [ ] Export from index

#### 1.1.3 Collection Service
**File**: `apps/svc-metadata/src/app/collection/collection.service.ts`

**Methods**:
- [ ] `listCollections(tenantId, options)`
- [ ] `getCollection(tenantId, code)`
- [ ] `createCollection(tenantId, dto)`
- [ ] `updateCollection(tenantId, code, dto)`
- [ ] `deleteCollection(tenantId, code)`
- [ ] `createStorageTable(tenantId, collection)` - Creates actual PG table
- [ ] `alterStorageTable(tenantId, collection, changes)`

#### 1.1.4 Collection Controller
**File**: `apps/svc-metadata/src/app/collection/collection.controller.ts`

**Endpoints**:
- [ ] `GET /collections` - List all collections
- [ ] `GET /collections/:code` - Get collection details
- [ ] `POST /collections` - Create collection
- [ ] `PATCH /collections/:code` - Update collection
- [ ] `DELETE /collections/:code` - Delete collection

### Sprint 1.2: Property Management

#### 1.2.1 Database Schema
**File**: `migrations/tenant/1787000001000-property-schema.ts`

**Tasks**:
- [ ] Create property_definition table
- [ ] Create choice_list table
- [ ] Create choice_item table
- [ ] Add foreign keys and indexes

#### 1.2.2 Property Entities
**Files**:
- `libs/tenant-db/src/lib/entities/property-definition.entity.ts`
- `libs/tenant-db/src/lib/entities/choice-list.entity.ts`
- `libs/tenant-db/src/lib/entities/choice-item.entity.ts`

**Tasks**:
- [ ] Create PropertyDefinition entity
- [ ] Create ChoiceList entity
- [ ] Create ChoiceItem entity
- [ ] Add relationships between entities
- [ ] Export from index

#### 1.2.3 Property Service
**File**: `apps/svc-metadata/src/app/property/property.service.ts`

**Methods**:
- [ ] `getProperties(tenantId, collectionCode)`
- [ ] `getProperty(tenantId, collectionCode, propertyCode)`
- [ ] `createProperty(tenantId, collectionCode, dto)`
- [ ] `updateProperty(tenantId, collectionCode, propertyCode, dto)`
- [ ] `deleteProperty(tenantId, collectionCode, propertyCode)`
- [ ] `addStorageColumn(tenantId, collection, property)` - Adds column to PG table
- [ ] `alterStorageColumn(tenantId, collection, property, changes)`
- [ ] `dropStorageColumn(tenantId, collection, property)`

#### 1.2.4 Property Controller
**File**: `apps/svc-metadata/src/app/property/property.controller.ts`

**Endpoints**:
- [ ] `GET /collections/:code/properties`
- [ ] `GET /collections/:code/properties/:propertyCode`
- [ ] `POST /collections/:code/properties`
- [ ] `PATCH /collections/:code/properties/:propertyCode`
- [ ] `DELETE /collections/:code/properties/:propertyCode`

### Sprint 1.3: Schema UI (Studio)

#### 1.3.1 Collection List Page
**File**: `apps/web-client/src/features/studio/schema/CollectionListPage.tsx`

**Features**:
- [ ] List all collections with icons
- [ ] Search/filter collections
- [ ] Show property count per collection
- [ ] Show record count per collection
- [ ] Create new collection button
- [ ] Mobile-responsive grid/list toggle

#### 1.3.2 Collection Editor
**File**: `apps/web-client/src/features/studio/schema/CollectionEditor.tsx`

**Tabs**:
- [ ] Properties tab (list and manage properties)
- [ ] Automations tab (linked automations)
- [ ] Access tab (access rules)
- [ ] Views tab (default views)
- [ ] Settings tab (collection settings)

#### 1.3.3 Property Editor Drawer
**File**: `apps/web-client/src/features/studio/schema/PropertyEditor.tsx`

**Features**:
- [ ] Property type selector with previews
- [ ] Validation rules section
- [ ] Display options section
- [ ] Advanced options (conditional visibility)
- [ ] Real-time preview

---

## Phase 2: Views Engine

**Goal**: User-customizable views with upgrade safety.

### Sprint 2.1: View Database Schema

#### 2.1.1 Platform View Tables
**File**: `migrations/platform/1787000000000-platform-views.ts`

**Tasks**:
- [ ] Create platform_view table (read-only templates)
- [ ] Seed default views for common collections

#### 2.1.2 Tenant View Tables
**File**: `migrations/tenant/1787000002000-view-schema.ts`

**Tasks**:
- [ ] Create workspace_view_override table
- [ ] Create user_view_preference table
- [ ] Create user_custom_view table
- [ ] Create board_view table
- [ ] Add indexes for performance

### Sprint 2.2: View Resolution Service

#### 2.2.1 View Service
**File**: `apps/svc-metadata/src/app/view/view.service.ts`

**Methods**:
- [ ] `resolveGridView(tenantId, userId, collectionCode)`
- [ ] `resolveDetailView(tenantId, userId, collectionCode)`
- [ ] `applyViewDelta(baseView, delta)`
- [ ] `saveUserPreference(tenantId, userId, collectionCode, delta)`
- [ ] `createCustomView(tenantId, userId, collectionCode, definition)`
- [ ] `getAvailableViews(tenantId, userId, collectionCode)`

#### 2.2.2 View Controller
**File**: `apps/svc-metadata/src/app/view/view.controller.ts`

**Endpoints**:
- [ ] `GET /collections/:code/views` - List available views
- [ ] `GET /collections/:code/views/resolve` - Get resolved view for current user
- [ ] `POST /collections/:code/views/preferences` - Save user preference
- [ ] `POST /collections/:code/views/custom` - Create custom view
- [ ] `DELETE /collections/:code/views/custom/:viewCode` - Delete custom view

### Sprint 2.3: Grid View Component

#### 2.3.1 Upgrade-Safe Grid
**File**: `apps/web-client/src/components/views/GridView.tsx`

**Features**:
- [ ] Render columns from resolved view
- [ ] Column resize with persistence
- [ ] Column reorder with persistence
- [ ] Column visibility toggle
- [ ] Save to user preference on change
- [ ] "What's new" indicator for platform updates
- [ ] Review changes modal

#### 2.3.2 View Selector
**File**: `apps/web-client/src/components/views/ViewSelector.tsx`

**Features**:
- [ ] Dropdown to select view
- [ ] Show platform, workspace, and personal views
- [ ] Quick create "Save as new view"
- [ ] Set as default option
- [ ] Pin to tabs option

### Sprint 2.4: Detail View Component

#### 2.4.1 Upgrade-Safe Detail View
**File**: `apps/web-client/src/components/views/DetailView.tsx`

**Features**:
- [ ] Render sections from resolved view
- [ ] Collapse/expand sections with persistence
- [ ] Hide properties (from personal preference)
- [ ] Section reordering
- [ ] Tabs for related data

#### 2.4.2 Hidden Field Handler
**File**: `apps/web-client/src/components/views/HiddenRequiredFieldsModal.tsx`

**Features**:
- [ ] Detect hidden required fields on save
- [ ] Show modal with required fields
- [ ] Render appropriate widgets for each field
- [ ] Validate inline
- [ ] Option to add field to view

### Sprint 2.5: Board View

#### 2.5.1 Kanban Board Component
**File**: `apps/web-client/src/components/views/BoardView.tsx`

**Features**:
- [ ] Lanes based on choice property
- [ ] Card rendering with configurable fields
- [ ] Drag and drop between lanes
- [ ] Lane collapse/expand
- [ ] Card click to open detail
- [ ] Mobile-friendly swipe

---

## Phase 3: Access Engine

**Goal**: Granular access control at collection, property, and row level.

### Sprint 3.1: Access Rule Schema

#### 3.1.1 Database Migration
**File**: `migrations/tenant/1787000003000-access-rules.ts`

**Tasks**:
- [ ] Enhance collection_access_rule table
- [ ] Create property_access_rule table
- [ ] Add row_condition support for ABAC
- [ ] Add indexes

### Sprint 3.2: Access Enforcement Middleware

#### 3.2.1 Collection Access Guard
**File**: `apps/svc-data/src/app/guards/collection-access.guard.ts`

**Tasks**:
- [ ] Check user roles against collection ACL
- [ ] Evaluate row-level conditions
- [ ] Cache access decisions
- [ ] Log access denials

#### 3.2.2 Property Access Filter
**File**: `apps/svc-data/src/app/interceptors/property-access.interceptor.ts`

**Tasks**:
- [ ] Filter properties on read based on access rules
- [ ] Block writes to protected properties
- [ ] Handle sensitive property masking

### Sprint 3.3: Access Management UI

#### 3.3.1 Access Rules Page
**File**: `apps/web-client/src/features/studio/access/AccessRulesPage.tsx`

**Features**:
- [ ] List all access rules
- [ ] Create/edit rule drawer
- [ ] Test rule against user
- [ ] Show effective permissions matrix

---

## Phase 4: Automation Engine

**Goal**: Business rules and display rules that react to data changes.

### Sprint 4.1: Automation Schema

#### 4.1.1 Database Migration
**File**: `migrations/tenant/1787000004000-automations.ts`

**Tasks**:
- [ ] Create automation table (refine from business_rule)
- [ ] Create display_rule table
- [ ] Create automation_execution_log table

### Sprint 4.2: Automation Execution Engine

#### 4.2.1 Automation Executor
**File**: `apps/svc-data/src/app/automation/automation-executor.service.ts`

**Tasks**:
- [ ] Hook into data CRUD operations
- [ ] Evaluate conditions
- [ ] Execute actions (set_value, validate, abort)
- [ ] Handle async actions
- [ ] Log execution results

#### 4.2.2 Display Rule Evaluator
**File**: `apps/svc-data/src/app/automation/display-rule-evaluator.service.ts`

**Tasks**:
- [ ] Evaluate display rules for a record
- [ ] Return show/hide/require/readonly directives
- [ ] Cache evaluations per record

### Sprint 4.3: Automation UI

#### 4.3.1 Automation List
**File**: `apps/web-client/src/features/studio/automations/AutomationListPage.tsx`

**Features**:
- [ ] List automations with status
- [ ] Filter by collection
- [ ] Toggle active/inactive
- [ ] Execution history link

#### 4.3.2 Automation Editor
**File**: `apps/web-client/src/features/studio/automations/AutomationEditor.tsx`

**Features**:
- [ ] Collection selector
- [ ] Trigger type selector
- [ ] Condition builder (visual)
- [ ] Action builder (visual)
- [ ] Test automation button
- [ ] Execution log viewer

---

## Phase 5: Flow Engine

**Goal**: Multi-step workflows with approvals.

### Sprint 5.1: Flow Schema

#### 5.1.1 Database Migration
**File**: `migrations/tenant/1787000005000-flows.ts`

**Tasks**:
- [ ] Refine flow_definition table
- [ ] Create flow_step table
- [ ] Create flow_transition table
- [ ] Create flow_instance table
- [ ] Create flow_step_execution table

### Sprint 5.2: Flow Execution Engine

#### 5.2.1 Flow Executor
**File**: `apps/svc-metadata/src/app/flow/flow-executor.service.ts`

**Tasks**:
- [ ] Start flow instance
- [ ] Execute step
- [ ] Handle transitions
- [ ] Manage state
- [ ] Handle timeouts
- [ ] Resume from wait states

#### 5.2.2 Approval Handler
**File**: `apps/svc-metadata/src/app/flow/approval-handler.service.ts`

**Tasks**:
- [ ] Create approval requests
- [ ] Process approvals/rejections
- [ ] Handle escalations
- [ ] Check delegation

### Sprint 5.3: Flow Designer

#### 5.3.1 Visual Flow Builder
**File**: `apps/web-client/src/features/studio/flows/FlowDesigner.tsx`

**Features**:
- [ ] Drag-and-drop step placement
- [ ] Connection drawing
- [ ] Step configuration panel
- [ ] Condition builder
- [ ] Approval configuration
- [ ] Save/publish workflow
- [ ] Version history

#### 5.3.2 Flow Instance Viewer
**File**: `apps/web-client/src/features/flows/FlowInstanceViewer.tsx`

**Features**:
- [ ] Show flow progress
- [ ] Highlight current step
- [ ] Show history
- [ ] Show pending actions

---

## Phase 6: Commitment Engine (SLA/OLA)

**Goal**: Time-based service commitments with tracking.

### Sprint 6.1: Commitment Schema

#### 6.1.1 Database Migration
**File**: `migrations/tenant/1787000006000-commitments.ts`

**Tasks**:
- [ ] Create commitment_definition table
- [ ] Create commitment_tracker table
- [ ] Create business_schedule table
- [ ] Create holiday_calendar table
- [ ] Create holiday table

### Sprint 6.2: Commitment Tracking Service

#### 6.2.1 Commitment Tracker
**File**: `apps/svc-metadata/src/app/commitment/commitment-tracker.service.ts`

**Tasks**:
- [ ] Start tracking on trigger
- [ ] Calculate target time (business hours aware)
- [ ] Handle pause/resume
- [ ] Check for warnings
- [ ] Check for breaches
- [ ] Execute breach actions

#### 6.2.2 Scheduled Checker
**File**: `apps/svc-metadata/src/app/commitment/commitment-scheduler.service.ts`

**Tasks**:
- [ ] Run periodic checks
- [ ] Send warning notifications
- [ ] Process breaches
- [ ] Update metrics

### Sprint 6.3: Commitment UI

#### 6.3.1 Commitment Definition Editor
**File**: `apps/web-client/src/features/studio/commitments/CommitmentEditor.tsx`

**Features**:
- [ ] Target time configuration
- [ ] Business hours selector
- [ ] Warning/breach thresholds
- [ ] Actions configuration
- [ ] Schedule selector

#### 6.3.2 Commitment Dashboard Widget
**File**: `apps/web-client/src/components/widgets/CommitmentWidget.tsx`

**Features**:
- [ ] Summary counts (on track, warning, breached)
- [ ] List of approaching breaches
- [ ] Click to view details

#### 6.3.3 Commitment Status in Detail View
**File**: `apps/web-client/src/components/views/CommitmentStatus.tsx`

**Features**:
- [ ] Progress bar per commitment
- [ ] Time remaining
- [ ] Pause indicator
- [ ] History popover

---

## Phase 7: Notification & Event System

**Goal**: Multi-channel notifications and event bus.

### Sprint 7.1: Notification Enhancement

#### 7.1.1 Notification Service Updates
**File**: `apps/svc-metadata/src/app/notification/notification.service.ts`

**Tasks**:
- [ ] Template variable resolution
- [ ] Multi-channel delivery (email, push, in-app)
- [ ] Digest mode support
- [ ] Delivery tracking
- [ ] Retry logic

#### 7.1.2 In-App Notification Component
**File**: `apps/web-client/src/components/notifications/NotificationCenter.tsx`

**Features**:
- [ ] Bell icon with unread count
- [ ] Notification dropdown
- [ ] Mark as read
- [ ] Click to navigate
- [ ] Clear all option

### Sprint 7.2: Event Bus

#### 7.2.1 Event Publisher
**File**: `apps/svc-data/src/app/events/event-publisher.service.ts`

**Tasks**:
- [ ] Publish events on data changes
- [ ] Include full event payload
- [ ] Log to event_log table

#### 7.2.2 Event Subscriber Registry
**File**: `apps/svc-metadata/src/app/events/event-subscriber.service.ts`

**Tasks**:
- [ ] Register event handlers
- [ ] Route events to automations
- [ ] Route events to notifications
- [ ] Route events to webhooks

---

## Phase 8: AVA AI Assistant

**Goal**: Tenant-isolated AI assistant.

### Sprint 8.1: AVA Backend

#### 8.1.1 AVA Schema
**File**: `migrations/tenant/1787000007000-ava.ts`

**Tasks**:
- [ ] Create ava_conversation table
- [ ] Create ava_message table
- [ ] Create ava_context table
- [ ] Create ava_action_log table

#### 8.1.2 AVA Service
**File**: `apps/svc-metadata/src/app/ava/ava.service.ts`

**Tasks**:
- [ ] Chat endpoint
- [ ] Context building (schema, user permissions)
- [ ] Tool definitions (search, create, update)
- [ ] Tool execution with permission checks
- [ ] Conversation history

### Sprint 8.2: AVA Frontend

#### 8.2.1 AVA Chat Panel
**File**: `apps/web-client/src/components/ava/AvaPanel.tsx`

**Features**:
- [ ] Floating button
- [ ] Slide-in panel
- [ ] Message history
- [ ] Typing indicator
- [ ] Quick action buttons
- [ ] Table/chart rendering for results

---

## Phase 9: Import/Export & Connections

**Goal**: Data portability and external integrations.

### Sprint 9.1: Import System

**Tasks**:
- [ ] Import definition UI
- [ ] File upload handler
- [ ] Column mapping UI
- [ ] Preview and validate
- [ ] Import execution
- [ ] Error handling and reporting

### Sprint 9.2: Export System

**Tasks**:
- [ ] Export definition UI
- [ ] Column selection
- [ ] Filter configuration
- [ ] Format selection (CSV, Excel, JSON, PDF)
- [ ] Scheduled exports

### Sprint 9.3: Connections Hub

**Tasks**:
- [ ] Connection definition schema
- [ ] OAuth flow for external services
- [ ] Webhook configuration
- [ ] Connection health monitoring
- [ ] REST API client

---

## Phase 10: Polish & Production Readiness

### Sprint 10.1: Performance Optimization

**Tasks**:
- [ ] Add database indexes based on query patterns
- [ ] Implement Redis caching for views and permissions
- [ ] Optimize bundle size with code splitting
- [ ] Add service worker for offline support
- [ ] Implement query result pagination/virtualization

### Sprint 10.2: Security Hardening

**Tasks**:
- [ ] Security audit of all endpoints
- [ ] Rate limiting implementation
- [ ] Input validation review
- [ ] SQL injection prevention audit
- [ ] XSS prevention audit
- [ ] CSRF protection verification

### Sprint 10.3: Monitoring & Observability

**Tasks**:
- [ ] Structured logging implementation
- [ ] Error tracking integration (Sentry)
- [ ] Performance monitoring
- [ ] Health check endpoints
- [ ] Metrics dashboard

### Sprint 10.4: Documentation

**Tasks**:
- [ ] API documentation (OpenAPI/Swagger)
- [ ] User guide
- [ ] Admin guide
- [ ] Developer guide
- [ ] Architecture documentation

---

## Summary: Phase Overview

| Phase | Name | Sprints | Key Deliverables |
|-------|------|---------|------------------|
| 0 | Foundation | 3 | Theme, Mobile Layout, Core Components |
| 1 | Schema Engine | 3 | Collections, Properties, Studio UI |
| 2 | Views Engine | 5 | Grid, Detail, Board Views, User Customization |
| 3 | Access Engine | 3 | ACLs, Property Access, UI |
| 4 | Automation Engine | 3 | Business Rules, Display Rules |
| 5 | Flow Engine | 3 | Workflows, Approvals |
| 6 | Commitment Engine | 3 | SLA/OLA Tracking |
| 7 | Notification & Events | 2 | Multi-channel, Event Bus |
| 8 | AVA AI | 2 | Chat, Tools, Actions |
| 9 | Import/Export | 3 | Data Portability, Connections |
| 10 | Polish | 4 | Performance, Security, Monitoring |

---

## Recommended Order of Implementation

### Immediate (Start Now)
1. **Pre-Implementation Cleanup** - Clean repository
2. **Phase 0: Foundation** - Essential for everything else

### Short Term (Next 2-4 Weeks)
3. **Phase 1: Schema Engine** - Core data structures
4. **Phase 2: Views Engine** - User experience

### Medium Term (1-2 Months)
5. **Phase 3: Access Engine** - Security foundation
6. **Phase 4: Automation Engine** - Business logic

### Longer Term (2-3 Months)
7. **Phase 5: Flow Engine** - Complex workflows
8. **Phase 6: Commitment Engine** - SLA/OLA

### Final Phases (3+ Months)
9. **Phase 7: Notifications** - Communication
10. **Phase 8: AVA AI** - Intelligence
11. **Phase 9: Import/Export** - Portability
12. **Phase 10: Polish** - Production ready
