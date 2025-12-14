# HubbleWave Platform Components

This document defines **platform-only components** - the building blocks that enable any application to be built. No application-specific features (Assets, Incidents, etc.) are included here.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HUBBLEWAVE PLATFORM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         USER EXPERIENCE LAYER                        │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │ Views   │ │ Layouts │ │Spotlight│ │Dashboard│ │   AVA   │       │   │
│  │  │ Engine  │ │ Engine  │ │ Search  │ │ Builder │ │   AI    │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        AUTOMATION LAYER                              │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │Automations│ │  Flows  │ │  SLA    │ │ Events  │ │Scheduled│       │   │
│  │  │ Engine  │ │ Engine  │ │ Engine  │ │   Bus   │ │  Tasks  │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         DATA LAYER                                   │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │ Schema  │ │  Query  │ │ Access  │ │  Audit  │ │ Import/ │       │   │
│  │  │ Engine  │ │ Engine  │ │ Engine  │ │ Logger  │ │ Export  │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         CORE SERVICES                                │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │Identity │ │Settings │ │Notifica-│ │Connecti-│ │  File   │       │   │
│  │  │ Service │ │ Service │ │  tions  │ │  ons    │ │ Storage │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Schema Engine

The foundation for all data in HubbleWave.

### 1.1 Collections

Define what data you store.

**Database: `collection_definition`**
```sql
CREATE TABLE collection_definition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL UNIQUE,        -- internal name: "customers"
  label VARCHAR(200) NOT NULL,               -- display: "Customers"
  label_plural VARCHAR(200),                 -- "Customers"
  description TEXT,
  icon VARCHAR(50),                          -- lucide icon name
  color VARCHAR(20),                         -- brand color

  -- Storage
  storage_table VARCHAR(100) NOT NULL,       -- actual PG table name
  storage_schema VARCHAR(50) DEFAULT 'public',

  -- Behavior
  is_extensible BOOLEAN DEFAULT true,        -- allow custom properties
  supports_attachments BOOLEAN DEFAULT true,
  supports_comments BOOLEAN DEFAULT true,
  supports_history BOOLEAN DEFAULT true,

  -- Hierarchy
  parent_collection_id UUID REFERENCES collection_definition(id),
  extends_collection_id UUID REFERENCES collection_definition(id),

  -- Classification
  category VARCHAR(50),                      -- "core", "custom", "system"
  is_system BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,

  -- Audit
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 Properties

Define fields within collections.

**Database: `property_definition`**
```sql
CREATE TABLE property_definition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collection_definition(id),

  code VARCHAR(100) NOT NULL,                -- internal: "first_name"
  label VARCHAR(200) NOT NULL,               -- display: "First Name"
  description TEXT,
  placeholder TEXT,
  help_text TEXT,

  -- Type
  data_type VARCHAR(50) NOT NULL,            -- text, number, date, reference, etc.
  ui_widget VARCHAR(50),                     -- input, textarea, select, etc.

  -- Storage
  storage_column VARCHAR(100),               -- actual PG column
  storage_type VARCHAR(50),                  -- varchar, integer, jsonb, etc.
  is_virtual BOOLEAN DEFAULT false,          -- computed, not stored
  virtual_expression TEXT,                   -- SQL/JS expression for computed

  -- Validation
  is_required BOOLEAN DEFAULT false,
  is_unique BOOLEAN DEFAULT false,
  min_value NUMERIC,
  max_value NUMERIC,
  min_length INTEGER,
  max_length INTEGER,
  pattern VARCHAR(500),                      -- regex
  pattern_message VARCHAR(200),              -- custom error for pattern
  custom_validator TEXT,                     -- JS validation function

  -- Reference (for reference type)
  reference_collection_id UUID REFERENCES collection_definition(id),
  reference_display_property VARCHAR(100),
  reference_filter JSONB,                    -- filter referenced items

  -- Choice (for choice type)
  choice_list_id UUID,                       -- link to choice_list
  choices JSONB,                             -- inline choices if no list
  allow_multiple BOOLEAN DEFAULT false,

  -- Default
  default_value TEXT,
  default_expression TEXT,                   -- dynamic default (JS)

  -- Display
  display_order INTEGER DEFAULT 0,
  show_in_grid BOOLEAN DEFAULT true,
  show_in_detail BOOLEAN DEFAULT true,
  show_in_create BOOLEAN DEFAULT true,
  grid_width INTEGER,                        -- px or percentage

  -- Responsive hints
  mobile_priority INTEGER DEFAULT 50,        -- 1-100, higher = more important
  mobile_widget VARCHAR(50),                 -- override widget for mobile
  collapsible BOOLEAN DEFAULT false,

  -- Access
  is_readonly BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  is_internal BOOLEAN DEFAULT false,         -- hidden from regular users

  -- Audit
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(collection_id, code)
);
```

### 1.3 Choice Lists

Reusable option sets.

**Database: `choice_list`**
```sql
CREATE TABLE choice_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL UNIQUE,
  label VARCHAR(200) NOT NULL,
  description TEXT,

  is_ordered BOOLEAN DEFAULT false,          -- maintain order
  allow_custom BOOLEAN DEFAULT false,        -- users can add values
  is_system BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE choice_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  choice_list_id UUID NOT NULL REFERENCES choice_list(id),

  value VARCHAR(100) NOT NULL,               -- stored value
  label VARCHAR(200) NOT NULL,               -- display label
  description TEXT,
  color VARCHAR(20),                         -- badge color
  icon VARCHAR(50),

  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,

  -- Conditional
  depends_on JSONB,                          -- show only when condition met

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(choice_list_id, value)
);
```

---

## 2. Views Engine - User Customization

**Key Principle**: Users own their views. Admins provide defaults and boundaries.

### 2.1 View Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                        VIEW HIERARCHY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  System Default View (Platform)                                 │
│         ↓ inherited by                                          │
│  Collection Default View (Admin)                                │
│         ↓ inherited by                                          │
│  Team View (Team-shared)                                        │
│         ↓ inherited by                                          │
│  Personal View (User's own)  ← USER CONTROLS THIS              │
│                                                                 │
│  User can:                                                      │
│  • Create unlimited personal views                              │
│  • Customize columns, order, widths                            │
│  • Set personal filters                                        │
│  • Hide/show properties in detail view                         │
│  • Rearrange form sections                                     │
│  • Set their own default view                                  │
│                                                                 │
│  Admin can:                                                     │
│  • Set workspace defaults                                       │
│  • Create shared team views                                     │
│  • Lock certain properties from being hidden                   │
│  • Set minimum required properties                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Grid View Definition

**Database: `grid_view`**
```sql
CREATE TABLE grid_view (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collection_definition(id),

  code VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  icon VARCHAR(50),

  -- Ownership
  owner_type VARCHAR(20) NOT NULL,           -- 'system', 'workspace', 'team', 'user'
  owner_id UUID,                             -- team_id or user_id

  -- Inheritance
  parent_view_id UUID REFERENCES grid_view(id),

  -- Columns
  columns JSONB NOT NULL,
  /*
  [
    {
      "propertyCode": "name",
      "width": 200,
      "visible": true,
      "order": 1,
      "sortable": true,
      "filterable": true,
      "pinned": "left"  -- null, "left", "right"
    },
    ...
  ]
  */

  -- Default sort
  default_sort JSONB,                        -- [{"property": "created_at", "direction": "desc"}]

  -- Default filters
  default_filters JSONB,                     -- permanent filters for this view

  -- Grouping
  group_by VARCHAR(100),                     -- property to group by
  group_collapsed BOOLEAN DEFAULT false,

  -- Display
  row_height VARCHAR(20) DEFAULT 'normal',   -- 'compact', 'normal', 'comfortable'
  show_row_numbers BOOLEAN DEFAULT false,
  enable_row_selection BOOLEAN DEFAULT true,

  -- Settings
  is_default BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,           -- show in view tabs
  is_locked BOOLEAN DEFAULT false,           -- admin locked, can't modify

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(collection_id, owner_type, owner_id, code)
);
```

### 2.3 Detail View Definition

**Database: `detail_view`**
```sql
CREATE TABLE detail_view (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collection_definition(id),

  code VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,

  -- Ownership (same as grid_view)
  owner_type VARCHAR(20) NOT NULL,
  owner_id UUID,
  parent_view_id UUID REFERENCES detail_view(id),

  -- Layout
  layout JSONB NOT NULL,
  /*
  {
    "sections": [
      {
        "id": "basic",
        "title": "Basic Information",
        "collapsible": true,
        "collapsed": false,
        "columns": 2,
        "properties": [
          {"code": "name", "width": "full", "visible": true},
          {"code": "status", "width": "half", "visible": true},
          {"code": "priority", "width": "half", "visible": true}
        ]
      },
      {
        "id": "details",
        "title": "Details",
        "collapsible": true,
        "collapsed": true,
        "properties": [...]
      }
    ],
    "tabs": [
      {"id": "history", "title": "History", "visible": true},
      {"id": "attachments", "title": "Files", "visible": true},
      {"id": "comments", "title": "Comments", "visible": true}
    ]
  }
  */

  -- Header configuration
  header_config JSONB,
  /*
  {
    "titleProperty": "name",
    "subtitleProperties": ["status", "created_at"],
    "showBreadcrumb": true,
    "showActions": true
  }
  */

  -- Mobile layout (separate for responsive)
  mobile_layout JSONB,

  is_default BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.4 User View Preferences

Per-user overrides without creating full custom views.

**Database: `user_view_preference`**
```sql
CREATE TABLE user_view_preference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  collection_id UUID NOT NULL REFERENCES collection_definition(id),

  -- Quick preferences (without creating a full view)
  preferred_grid_view_id UUID REFERENCES grid_view(id),
  preferred_detail_view_id UUID REFERENCES detail_view(id),

  -- Column overrides for default view
  column_overrides JSONB,
  /*
  {
    "hidden": ["internal_notes", "created_by"],
    "widths": {"name": 300, "status": 120},
    "order": ["name", "status", "owner", "created_at"]
  }
  */

  -- Detail view overrides
  detail_overrides JSONB,
  /*
  {
    "hiddenProperties": ["internal_notes"],
    "collapsedSections": ["system_info"],
    "hiddenTabs": ["raw_data"]
  }
  */

  -- Saved filters (personal quick filters)
  saved_filters JSONB,
  /*
  [
    {"name": "My Items", "filter": {"owner": "@me"}},
    {"name": "High Priority", "filter": {"priority": "high"}}
  ]
  */

  -- Last used state
  last_filters JSONB,
  last_sort JSONB,
  last_page_size INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, collection_id)
);
```

### 2.5 Board View (Kanban)

**Database: `board_view`**
```sql
CREATE TABLE board_view (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collection_definition(id),

  code VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,

  owner_type VARCHAR(20) NOT NULL,
  owner_id UUID,

  -- Board configuration
  lane_property VARCHAR(100) NOT NULL,       -- property to group by (usually status)
  lane_order JSONB,                          -- explicit lane ordering

  -- Card configuration
  card_config JSONB NOT NULL,
  /*
  {
    "titleProperty": "name",
    "subtitleProperty": "description",
    "colorProperty": "priority",
    "showAvatar": true,
    "avatarProperty": "owner",
    "showDueDate": true,
    "dueDateProperty": "due_date",
    "showLabels": true,
    "labelProperties": ["category", "type"],
    "showProgress": false,
    "progressProperty": null
  }
  */

  -- Behavior
  allow_drag BOOLEAN DEFAULT true,
  show_column_counts BOOLEAN DEFAULT true,
  show_wip_limits BOOLEAN DEFAULT false,
  wip_limits JSONB,                          -- {"in_progress": 5, "review": 3}

  is_default BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Hidden Required Fields Handling

**Key Principle**: System validation runs regardless of UI visibility. Users get a graceful way to provide required data.

### 3.1 The Problem

User hides "Approval Notes" from their form, but it's required when status = "Approved".

### 3.2 The Solution: Smart Prompts

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Save                                                           │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ⚠️ Additional Information Required                             │
│                                                                 │
│  Some required information is not in your current view.         │
│  Please provide the following:                                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Approval Notes *                                        │   │
│  │ ┌───────────────────────────────────────────────────┐   │   │
│  │ │                                                   │   │   │
│  │ │                                                   │   │   │
│  │ └───────────────────────────────────────────────────┘   │   │
│  │ Required when status is "Approved"                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Tip: Add this field to your view for faster access next time  │
│       [Add to my view]                                          │
│                                                                 │
│                                    Cancel    Save               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Implementation

**Database: `property_definition` additions**
```sql
ALTER TABLE property_definition ADD COLUMN
  -- Conditional requirements
  required_when JSONB,
  /*
  {
    "condition": {"property": "status", "operator": "equals", "value": "approved"},
    "message": "Required when status is Approved"
  }
  */

  -- Prompt configuration
  prompt_title VARCHAR(200),                 -- "Approval Notes"
  prompt_description TEXT,                   -- "Please explain why..."
  can_be_hidden BOOLEAN DEFAULT true,        -- false = must always show
  hidden_prompt_mode VARCHAR(20) DEFAULT 'modal'  -- 'modal', 'inline', 'block'
;
```

**Validation Flow:**
```typescript
interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
  hiddenRequiredFields: HiddenFieldPrompt[];
}

interface HiddenFieldPrompt {
  propertyCode: string;
  propertyLabel: string;
  reason: string;           // "Required when status is Approved"
  currentValue: any;
  widget: string;           // UI widget to render
  validation: PropertyValidation;
}

// On save attempt:
// 1. Run all validations (visible + hidden fields)
// 2. If hidden required fields are empty, return prompts
// 3. Show modal with prompts
// 4. User fills in values
// 5. Merge with form data and save
```

### 3.4 Smart Defaults

System can auto-fill hidden required fields when possible:

```sql
ALTER TABLE property_definition ADD COLUMN
  auto_fill_when_hidden BOOLEAN DEFAULT false,
  auto_fill_expression TEXT  -- JS expression to compute value
;

-- Example: auto-fill "approved_by" with current user when hidden
-- auto_fill_expression: "context.currentUser.id"
```

---

## 4. SLA & OLA Engine

### 4.1 Commitment Definitions

We call them **Commitments** (clearer than SLA/OLA jargon).

**Database: `commitment_definition`**
```sql
CREATE TABLE commitment_definition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Type
  commitment_type VARCHAR(20) NOT NULL,      -- 'sla' (external), 'ola' (internal), 'uc' (underpinning)

  -- Scope
  collection_id UUID NOT NULL REFERENCES collection_definition(id),
  applies_when JSONB,                        -- condition when this commitment applies
  /*
  {
    "and": [
      {"property": "priority", "operator": "equals", "value": "high"},
      {"property": "category", "operator": "in", "values": ["network", "security"]}
    ]
  }
  */

  -- Targets
  response_target JSONB,                     -- time to first response
  resolution_target JSONB,                   -- time to resolution
  /*
  {
    "duration": 4,
    "unit": "hours",           -- 'minutes', 'hours', 'days'
    "business_hours": true,
    "schedule_id": "uuid"      -- reference to business schedule
  }
  */

  -- Measurement
  start_condition JSONB,                     -- when clock starts
  pause_conditions JSONB[],                  -- when clock pauses
  stop_condition JSONB,                      -- when clock stops

  -- Breach actions
  warning_threshold INTEGER DEFAULT 75,      -- % of target
  breach_threshold INTEGER DEFAULT 100,

  on_warning JSONB,                          -- actions at warning
  on_breach JSONB,                           -- actions on breach
  /*
  {
    "notify": ["owner", "manager"],
    "escalate_to": "uuid",     -- escalate to user/team
    "set_values": {"escalated": true},
    "run_automation": "uuid"
  }
  */

  -- Schedule
  business_schedule_id UUID,                 -- work hours, holidays

  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100,              -- for conflict resolution

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Commitment Tracking

**Database: `commitment_tracker`**
```sql
CREATE TABLE commitment_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  commitment_id UUID NOT NULL REFERENCES commitment_definition(id),
  collection_id UUID NOT NULL,
  record_id UUID NOT NULL,

  -- Current state
  state VARCHAR(20) NOT NULL DEFAULT 'running',  -- 'running', 'paused', 'met', 'breached', 'cancelled'

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  target_at TIMESTAMPTZ NOT NULL,            -- when target expires

  -- Pause tracking
  paused_at TIMESTAMPTZ,
  total_paused_seconds BIGINT DEFAULT 0,
  pause_history JSONB DEFAULT '[]',
  /*
  [
    {"paused_at": "...", "resumed_at": "...", "reason": "Waiting for customer"},
    ...
  ]
  */

  -- Completion
  completed_at TIMESTAMPTZ,
  completion_state VARCHAR(20),              -- 'met', 'breached'
  actual_duration_seconds BIGINT,

  -- Warnings
  warning_sent BOOLEAN DEFAULT false,
  warning_sent_at TIMESTAMPTZ,

  -- Breach
  breached BOOLEAN DEFAULT false,
  breached_at TIMESTAMPTZ,
  breach_notified BOOLEAN DEFAULT false,

  -- Metadata
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(commitment_id, record_id)
);

-- Index for efficient querying
CREATE INDEX idx_commitment_tracker_active
  ON commitment_tracker(collection_id, record_id)
  WHERE state IN ('running', 'paused');

CREATE INDEX idx_commitment_tracker_approaching
  ON commitment_tracker(target_at)
  WHERE state = 'running' AND NOT warning_sent;
```

### 4.3 Business Schedules

**Database: `business_schedule`**
```sql
CREATE TABLE business_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,

  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',

  -- Weekly hours
  weekly_hours JSONB NOT NULL,
  /*
  {
    "monday": [{"start": "09:00", "end": "17:00"}],
    "tuesday": [{"start": "09:00", "end": "17:00"}],
    "wednesday": [{"start": "09:00", "end": "17:00"}],
    "thursday": [{"start": "09:00", "end": "17:00"}],
    "friday": [{"start": "09:00", "end": "17:00"}],
    "saturday": [],
    "sunday": []
  }
  */

  -- Holiday calendar
  holiday_calendar_id UUID,

  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE holiday_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE holiday (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES holiday_calendar(id),

  date DATE NOT NULL,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(20) DEFAULT 'full',           -- 'full', 'half', 'partial'
  partial_hours JSONB,                       -- for partial days
  recurring BOOLEAN DEFAULT false,           -- annual recurring

  UNIQUE(calendar_id, date)
);
```

### 4.4 Commitment UI

**Dashboard Widget:**
```
┌─────────────────────────────────────────────────────────────────┐
│  SLA Status                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │     12      │ │      3      │ │      1      │               │
│  │   On Track  │ │   Warning   │ │   Breached  │               │
│  │     🟢      │ │     🟡      │ │     🔴      │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│                                                                 │
│  Approaching Breach:                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ISS-234 │ High Priority Response │ ⏱️ 45 min remaining │   │
│  │ ISS-228 │ Resolution Target      │ ⏱️ 2h remaining     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Detail View Integration:**
```
┌─────────────────────────────────────────────────────────────────┐
│  ISS-234: Network Issue                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Commitments                                           ──────   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  Response SLA        ████████████████░░░░  80%          │   │
│  │  Target: 1 hour      ⏱️ 12 min remaining                │   │
│  │  Status: 🟡 Warning                                     │   │
│  │                                                         │   │
│  │  Resolution SLA      ████████░░░░░░░░░░░░  40%          │   │
│  │  Target: 4 hours     ⏱️ 2h 24min remaining              │   │
│  │  Status: 🟢 On Track                                    │   │
│  │                                                         │   │
│  │  ⏸️ Paused: 15 min (Waiting for customer)               │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Access Engine

### 5.1 Collection Access Rules

**Database: `collection_access_rule`**
```sql
CREATE TABLE collection_access_rule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  collection_id UUID NOT NULL REFERENCES collection_definition(id),

  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Principal
  principal_type VARCHAR(20) NOT NULL,       -- 'role', 'team', 'user', 'everyone'
  principal_id UUID,                         -- null for 'everyone'

  -- Operations
  can_read BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_update BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,

  -- Conditions (row-level)
  condition JSONB,                           -- filter which records
  /*
  {
    "or": [
      {"property": "owner_id", "operator": "equals", "value": "@currentUser.id"},
      {"property": "team_id", "operator": "in", "value": "@currentUser.teamIds"}
    ]
  }
  */

  -- Priority (lower = evaluated first)
  priority INTEGER DEFAULT 100,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2 Property Access Rules

**Database: `property_access_rule`**
```sql
CREATE TABLE property_access_rule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  property_id UUID NOT NULL REFERENCES property_definition(id),

  name VARCHAR(200),

  principal_type VARCHAR(20) NOT NULL,
  principal_id UUID,

  can_read BOOLEAN DEFAULT true,
  can_write BOOLEAN DEFAULT true,

  -- Conditional access
  condition JSONB,

  priority INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Automation Engine

### 6.1 Automations (Business Rules)

**Database: `automation`**
```sql
CREATE TABLE automation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,

  collection_id UUID NOT NULL REFERENCES collection_definition(id),

  -- Trigger
  trigger_type VARCHAR(30) NOT NULL,         -- 'on_create', 'on_update', 'on_delete', 'scheduled'
  trigger_config JSONB,
  /*
  For on_update: {"watch_properties": ["status", "priority"]}
  For scheduled: {"cron": "0 9 * * 1", "timezone": "America/New_York"}
  */

  -- Condition
  condition JSONB,                           -- when to run

  -- Actions
  actions JSONB NOT NULL,
  /*
  [
    {
      "type": "set_value",
      "config": {"property": "updated_at", "value": "@now"}
    },
    {
      "type": "send_notification",
      "config": {"template": "status_changed", "to": "@record.owner"}
    },
    {
      "type": "run_script",
      "config": {"script": "..."}
    }
  ]
  */

  -- Execution
  execution_order INTEGER DEFAULT 100,
  run_async BOOLEAN DEFAULT false,

  -- Error handling
  on_error VARCHAR(30) DEFAULT 'stop',       -- 'stop', 'continue', 'notify'

  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.2 Display Rules

**Database: `display_rule`**
```sql
CREATE TABLE display_rule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  collection_id UUID NOT NULL REFERENCES collection_definition(id),

  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- When to apply
  applies_on VARCHAR(30) NOT NULL,           -- 'load', 'change', 'both'
  condition JSONB,

  -- What to do
  actions JSONB NOT NULL,
  /*
  [
    {"action": "show", "properties": ["approval_notes", "approver"]},
    {"action": "hide", "properties": ["internal_cost"]},
    {"action": "require", "properties": ["reason"]},
    {"action": "readonly", "properties": ["status"]},
    {"action": "set_value", "property": "priority", "value": "high"}
  ]
  */

  execution_order INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. Flow Engine

### 7.1 Flow Definitions

**Database: `flow_definition`**
```sql
CREATE TABLE flow_definition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,

  collection_id UUID REFERENCES collection_definition(id),  -- null for standalone

  -- Trigger
  trigger_type VARCHAR(30) NOT NULL,
  trigger_config JSONB,

  -- Version control
  version INTEGER DEFAULT 1,
  is_draft BOOLEAN DEFAULT true,
  published_at TIMESTAMPTZ,
  published_by UUID,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.2 Flow Steps

**Database: `flow_step`**
```sql
CREATE TABLE flow_step (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  flow_id UUID NOT NULL REFERENCES flow_definition(id),

  step_type VARCHAR(50) NOT NULL,            -- 'start', 'condition', 'action', 'approval', 'wait', 'end'
  name VARCHAR(200) NOT NULL,
  description TEXT,

  config JSONB NOT NULL,
  /*
  Varies by type:

  condition: {
    "expression": {...},
    "true_step_id": "uuid",
    "false_step_id": "uuid"
  }

  approval: {
    "approvers": {"type": "role", "value": "manager"},
    "approval_type": "any",  -- 'any', 'all', 'majority'
    "timeout": {"duration": 48, "unit": "hours"},
    "on_timeout": "reject",
    "approved_step_id": "uuid",
    "rejected_step_id": "uuid"
  }

  action: {
    "actions": [...],
    "next_step_id": "uuid"
  }

  wait: {
    "wait_for": "event",  -- 'duration', 'event', 'condition'
    "event_type": "status_changed",
    "next_step_id": "uuid"
  }
  */

  -- Visual position (for designer)
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.3 Flow Instances

**Database: `flow_instance`**
```sql
CREATE TABLE flow_instance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  flow_id UUID NOT NULL REFERENCES flow_definition(id),
  flow_version INTEGER NOT NULL,

  -- Context
  collection_id UUID,
  record_id UUID,

  -- State
  state VARCHAR(30) NOT NULL DEFAULT 'running',  -- 'running', 'waiting', 'completed', 'failed', 'cancelled'
  current_step_id UUID REFERENCES flow_step(id),

  -- Variables
  variables JSONB DEFAULT '{}',

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Error
  error_message TEXT,
  error_step_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. Notification Engine

### 8.1 Notification Templates

**Database: `notification_template`**
```sql
CREATE TABLE notification_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Channels
  channels JSONB NOT NULL DEFAULT '["email", "in_app"]',

  -- Content per channel
  email_subject TEXT,
  email_body TEXT,                           -- Markdown with variables

  push_title TEXT,
  push_body TEXT,

  in_app_title TEXT,
  in_app_body TEXT,
  in_app_action_url TEXT,

  sms_body TEXT,

  -- Variables documentation
  available_variables JSONB,                 -- for template editor

  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 8.2 Notification Rules

**Database: `notification_rule`**
```sql
CREATE TABLE notification_rule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(200) NOT NULL,
  description TEXT,

  collection_id UUID REFERENCES collection_definition(id),

  -- Trigger
  trigger_type VARCHAR(30) NOT NULL,         -- 'event', 'scheduled', 'sla_warning', 'sla_breach'
  trigger_config JSONB,

  -- Condition
  condition JSONB,

  -- Template
  template_id UUID NOT NULL REFERENCES notification_template(id),

  -- Recipients
  recipients JSONB NOT NULL,
  /*
  {
    "users": ["@record.owner", "@record.created_by"],
    "roles": ["admin"],
    "teams": ["@record.team_id"],
    "emails": ["external@example.com"]
  }
  */

  -- Digest
  digest_mode VARCHAR(30) DEFAULT 'instant', -- 'instant', 'hourly', 'daily', 'weekly'

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 9. Event Bus

### 9.1 Event Definitions

**Database: `event_definition`**
```sql
CREATE TABLE event_definition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Scope
  collection_id UUID REFERENCES collection_definition(id),

  -- Schema
  payload_schema JSONB,                      -- JSON Schema for payload

  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 9.2 Event Log

**Database: `event_log`** (partitioned by date)
```sql
CREATE TABLE event_log (
  id UUID DEFAULT gen_random_uuid(),

  event_code VARCHAR(100) NOT NULL,

  -- Context
  collection_id UUID,
  record_id UUID,
  user_id UUID,

  -- Payload
  payload JSONB,

  -- Metadata
  source VARCHAR(50),                        -- 'api', 'automation', 'flow', 'user'
  correlation_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE event_log_2024_12 PARTITION OF event_log
  FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
```

---

## 10. Identity & Settings

### 10.1 User Preferences

**Database: `user_preference`**
```sql
CREATE TABLE user_preference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,

  -- Appearance
  theme VARCHAR(20) DEFAULT 'system',        -- 'light', 'dark', 'system'
  sidebar_collapsed BOOLEAN DEFAULT false,
  compact_mode BOOLEAN DEFAULT false,

  -- Regional
  language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50),
  date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
  time_format VARCHAR(20) DEFAULT 'HH:mm',
  number_format VARCHAR(20) DEFAULT 'en-US',

  -- Notifications
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  in_app_notifications BOOLEAN DEFAULT true,
  notification_digest VARCHAR(20) DEFAULT 'instant',

  -- Dashboard
  default_dashboard_id UUID,
  pinned_collections JSONB DEFAULT '[]',

  -- Keyboard
  keyboard_shortcuts BOOLEAN DEFAULT true,
  custom_shortcuts JSONB DEFAULT '{}',

  -- AVA
  ava_enabled BOOLEAN DEFAULT true,
  ava_suggestions BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 10.2 Workspace Settings

**Database: `workspace_setting`**
```sql
CREATE TABLE workspace_setting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  category VARCHAR(50) NOT NULL,
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,

  -- Metadata
  value_type VARCHAR(20) NOT NULL,           -- 'string', 'number', 'boolean', 'json'
  display_name VARCHAR(200),
  description TEXT,

  -- UI
  ui_component VARCHAR(50),                  -- 'text', 'toggle', 'select', etc.
  ui_options JSONB,

  -- Validation
  validation_rules JSONB,

  -- Access
  requires_admin BOOLEAN DEFAULT true,
  is_sensitive BOOLEAN DEFAULT false,        -- mask in logs

  display_order INTEGER DEFAULT 0,

  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(category, key)
);
```

---

## 11. Audit & History

### 11.1 Audit Log

**Database: `audit_log`** (partitioned)
```sql
CREATE TABLE audit_log (
  id UUID DEFAULT gen_random_uuid(),

  -- What
  action VARCHAR(50) NOT NULL,               -- 'create', 'update', 'delete', 'view', 'export'
  collection_id UUID,
  record_id UUID,

  -- Who
  user_id UUID,
  user_name VARCHAR(200),
  impersonated_by UUID,

  -- Changes
  old_values JSONB,
  new_values JSONB,
  changed_properties TEXT[],

  -- Context
  ip_address VARCHAR(45),
  user_agent TEXT,
  session_id UUID,
  correlation_id UUID,

  -- Metadata
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
```

### 11.2 Record History

**Database: `record_history`**
```sql
CREATE TABLE record_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  collection_id UUID NOT NULL,
  record_id UUID NOT NULL,

  version INTEGER NOT NULL,

  -- Snapshot
  data JSONB NOT NULL,                       -- full record at this version

  -- Change info
  changed_by UUID,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  change_type VARCHAR(20),                   -- 'create', 'update', 'restore'
  change_comment TEXT,

  UNIQUE(collection_id, record_id, version)
);
```

---

## 12. Import/Export

### 12.1 Import Definition

**Database: `import_definition`**
```sql
CREATE TABLE import_definition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,

  collection_id UUID NOT NULL REFERENCES collection_definition(id),

  -- Source
  source_type VARCHAR(30) NOT NULL,          -- 'file', 'api', 'database'
  source_config JSONB,

  -- Mapping
  column_mapping JSONB NOT NULL,
  /*
  [
    {"source": "First Name", "target": "first_name", "transform": null},
    {"source": "Status", "target": "status", "transform": "lowercase"},
    {"source": "Start Date", "target": "start_date", "transform": "date:MM/DD/YYYY"}
  ]
  */

  -- Behavior
  on_duplicate VARCHAR(30) DEFAULT 'skip',   -- 'skip', 'update', 'error'
  duplicate_key VARCHAR(100),

  -- Validation
  validate_before_import BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 12.2 Export Definition

**Database: `export_definition`**
```sql
CREATE TABLE export_definition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,

  collection_id UUID NOT NULL REFERENCES collection_definition(id),

  -- Format
  format VARCHAR(20) NOT NULL,               -- 'csv', 'xlsx', 'json', 'pdf'

  -- Columns
  columns JSONB NOT NULL,
  /*
  [
    {"property": "name", "header": "Name", "width": 200},
    {"property": "status", "header": "Status", "format": "label"},
    {"property": "created_at", "header": "Created", "format": "date:YYYY-MM-DD"}
  ]
  */

  -- Filters
  default_filters JSONB,

  -- Schedule (for automated exports)
  schedule JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 13. Connections (Integrations)

### 13.1 Connection Definition

**Database: `connection_definition`**
```sql
CREATE TABLE connection_definition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Type
  connection_type VARCHAR(50) NOT NULL,      -- 'rest_api', 'database', 'oauth', 'webhook'

  -- Configuration
  config JSONB NOT NULL,
  /*
  For REST API:
  {
    "base_url": "https://api.example.com",
    "auth_type": "bearer",
    "headers": {"X-Api-Key": "{{secret:api_key}}"}
  }

  For OAuth:
  {
    "provider": "microsoft",
    "client_id": "...",
    "client_secret": "{{secret:ms_secret}}",
    "scopes": ["openid", "profile", "email"]
  }
  */

  -- Secrets (stored encrypted separately)
  secrets JSONB,

  -- Health
  last_check_at TIMESTAMPTZ,
  last_check_status VARCHAR(20),

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Summary: Platform Components Only

### Data Layer
- Collections (Tables)
- Properties (Fields)
- Choice Lists
- Views (Grid, Detail, Board, Calendar)
- User View Customization

### Automation Layer
- Automations (Business Rules)
- Display Rules (UI Policies)
- Flows (Workflows)
- Scheduled Tasks

### Commitment Layer (SLA/OLA)
- Commitment Definitions
- Commitment Tracking
- Business Schedules
- Holiday Calendars

### Access Layer
- Collection Access Rules
- Property Access Rules
- Row-Level Conditions

### Communication Layer
- Notification Templates
- Notification Rules
- Event Definitions
- Event Log

### Identity Layer
- Users & Teams
- Roles & Permissions
- User Preferences
- Workspace Settings

### Operations Layer
- Audit Log
- Record History
- Import/Export
- Connections

### Intelligence Layer
- AVA AI Assistant
- Spotlight Search
- Dashboard Builder
