# View Customization & Upgrade Safety

## The Challenge

When platform upgrades add new properties or modify default views, we must:
1. **Not break** custom views users have created
2. **Not force** users to lose their customizations
3. **Gracefully introduce** new properties to custom views
4. **Allow users** to adopt platform enhancements optionally

---

## Solution: Delta-Based View Inheritance

Instead of storing complete view definitions, we store **deltas (differences)** from the parent view.

### View Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                      VIEW INHERITANCE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   PLATFORM DEFAULT (Source of Truth)                            │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Properties: [name, status, owner, created_at, priority] │   │
│   │ Order: as listed                                        │   │
│   │ Widths: {name: 200, status: 100, ...}                  │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           │                                      │
│                           ▼ inherits                             │
│   WORKSPACE OVERRIDE (Admin customizations)                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Delta: {                                                │   │
│   │   add: [custom_field_1],                               │   │
│   │   hide: [],                                            │   │
│   │   reorder: {priority: 2},                              │   │
│   │   resize: {name: 250}                                  │   │
│   │ }                                                       │   │
│   └─────────────────────────────────────────────────────────┘   │
│                           │                                      │
│                           ▼ inherits                             │
│   USER CUSTOMIZATION (Personal preferences)                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Delta: {                                                │   │
│   │   hide: [priority],                                    │   │
│   │   resize: {status: 120}                                │   │
│   │ }                                                       │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   COMPUTED VIEW (What user sees)                                │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ [name(250), status(120), owner, created_at, custom_1]  │   │
│   │ (priority hidden per user preference)                   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Platform Views (Immutable, Upgraded by Platform)

```sql
-- Stored in Platform DB (read-only for tenants)
CREATE TABLE platform_view (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  collection_code VARCHAR(100) NOT NULL,     -- e.g., 'issues'
  view_type VARCHAR(20) NOT NULL,            -- 'grid', 'detail', 'board'
  code VARCHAR(100) NOT NULL,                -- 'default', 'compact', etc.

  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Full definition (source of truth)
  definition JSONB NOT NULL,
  /*
  For grid:
  {
    "columns": [
      {"property": "name", "width": 200, "visible": true, "order": 1, "locked": false},
      {"property": "status", "width": 100, "visible": true, "order": 2, "locked": false},
      {"property": "owner", "width": 150, "visible": true, "order": 3, "locked": false},
      {"property": "created_at", "width": 150, "visible": true, "order": 4, "locked": false}
    ],
    "defaultSort": [{"property": "created_at", "direction": "desc"}],
    "rowHeight": "normal"
  }

  For detail:
  {
    "sections": [
      {
        "id": "header",
        "type": "header",
        "locked": true,  // Can't remove header
        "properties": ["name", "status"]
      },
      {
        "id": "basic",
        "title": "Basic Information",
        "collapsible": true,
        "columns": 2,
        "properties": [
          {"code": "description", "span": "full"},
          {"code": "priority", "span": "half"},
          {"code": "owner", "span": "half"}
        ]
      }
    ],
    "tabs": [
      {"id": "activity", "title": "Activity", "visible": true},
      {"id": "attachments", "title": "Files", "visible": true}
    ]
  }
  */

  -- Version for upgrade tracking
  platform_version VARCHAR(20) NOT NULL,

  is_default BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(collection_code, view_type, code)
);
```

### Workspace View Overrides (Tenant DB)

```sql
-- Admin customizations that apply workspace-wide
CREATE TABLE workspace_view_override (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to platform view (or null for custom view)
  platform_view_code VARCHAR(100),           -- null = fully custom view

  collection_code VARCHAR(100) NOT NULL,
  view_type VARCHAR(20) NOT NULL,
  code VARCHAR(100) NOT NULL,                -- unique within workspace

  name VARCHAR(200) NOT NULL,

  -- Delta from platform view
  delta JSONB,
  /*
  {
    "columns": {
      "add": [
        {"property": "custom_field", "width": 150, "after": "status"}
      ],
      "remove": [],  // Admin typically doesn't remove platform columns
      "modify": {
        "name": {"width": 250}
      },
      "reorder": [
        {"property": "priority", "after": "name"}
      ]
    },
    "defaultSort": [{"property": "priority", "direction": "asc"}]
  }
  */

  -- For fully custom views (platform_view_code = null)
  full_definition JSONB,

  -- Settings
  is_default BOOLEAN DEFAULT false,          -- workspace default
  is_locked BOOLEAN DEFAULT false,           -- users can't modify

  -- Access control
  visible_to_roles JSONB,                    -- null = everyone

  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(collection_code, view_type, code)
);
```

### User View Preferences (Tenant DB)

```sql
-- Personal customizations
CREATE TABLE user_view_preference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL,
  collection_code VARCHAR(100) NOT NULL,
  view_type VARCHAR(20) NOT NULL,

  -- Which view to customize
  base_view_code VARCHAR(100) NOT NULL,      -- workspace or platform view code

  -- Personal delta
  delta JSONB,
  /*
  {
    "columns": {
      "hide": ["internal_notes", "created_by"],  // Hidden, not removed
      "show": ["priority"],                       // Un-hide if was hidden
      "resize": {"name": 300, "status": 80},
      "reorder": [{"property": "owner", "position": 2}]
    },
    "collapsedSections": ["system_info"],
    "pinnedFilters": [
      {"name": "My Items", "filter": {"owner": "@me"}}
    ]
  }
  */

  -- User's default for this collection
  is_default BOOLEAN DEFAULT false,

  -- Pinned to view tabs
  is_pinned BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, collection_code, view_type, base_view_code)
);

-- User's fully custom views
CREATE TABLE user_custom_view (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL,
  collection_code VARCHAR(100) NOT NULL,
  view_type VARCHAR(20) NOT NULL,
  code VARCHAR(100) NOT NULL,

  name VARCHAR(200) NOT NULL,

  -- Full definition (not delta-based)
  definition JSONB NOT NULL,

  is_default BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,

  -- Share settings
  is_shared BOOLEAN DEFAULT false,           -- shared with team
  shared_with_team_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, collection_code, view_type, code)
);
```

---

## Upgrade Scenarios

### Scenario 1: Platform Adds New Property

**Platform Update:**
```json
// Platform adds "sla_status" to issues default grid
{
  "columns": [
    {"property": "name", ...},
    {"property": "status", ...},
    {"property": "sla_status", ...},  // NEW
    {"property": "owner", ...}
  ]
}
```

**User Experience:**

| User's Customization | What Happens |
|---------------------|--------------|
| Using platform default | Sees new column automatically |
| Using platform default + hidden columns | Sees new column (their hidden list unchanged) |
| Using workspace override | Admin decides to add or not |
| Using custom view | Not affected, can add manually |

**How it works:**
```typescript
function computeGridView(
  platformView: PlatformView,
  workspaceOverride?: WorkspaceViewOverride,
  userPreference?: UserViewPreference
): ComputedGridView {

  // Start with platform definition
  let columns = [...platformView.definition.columns];

  // Apply workspace delta
  if (workspaceOverride?.delta) {
    columns = applyDelta(columns, workspaceOverride.delta.columns);
  }

  // Apply user delta (hide/show/resize/reorder only)
  if (userPreference?.delta) {
    columns = applyUserDelta(columns, userPreference.delta.columns);
  }

  return { columns, ... };
}

function applyUserDelta(columns, userDelta) {
  // User can only hide (not remove), resize, reorder
  // New platform columns appear unless explicitly hidden

  return columns.map(col => {
    const isHidden = userDelta.hide?.includes(col.property);
    const customWidth = userDelta.resize?.[col.property];
    const customOrder = userDelta.reorder?.find(r => r.property === col.property);

    return {
      ...col,
      visible: isHidden ? false : col.visible,
      width: customWidth ?? col.width,
      order: customOrder?.position ?? col.order
    };
  }).sort((a, b) => a.order - b.order);
}
```

### Scenario 2: Platform Modifies Existing Property Display

**Platform Update:**
```json
// Platform changes "status" column width from 100 to 120
{
  "columns": [
    {"property": "status", "width": 120, ...}  // Changed from 100
  ]
}
```

**User Experience:**

| User's Customization | What Happens |
|---------------------|--------------|
| Never customized status width | Gets new width (120) |
| Explicitly set status width to 150 | Keeps their width (150) |

**How it works:**
```typescript
// User delta tracks explicit customizations
userDelta.resize = {"status": 150};  // User set this

// When computing, user's explicit value wins
const width = userDelta.resize?.["status"] ?? platformColumn.width;
```

### Scenario 3: Platform Removes a Property

**Platform Update:**
```json
// Platform removes deprecated "legacy_id" column
// Old: {"property": "legacy_id", ...}
// New: (removed)
```

**User Experience:**

| User's Customization | What Happens |
|---------------------|--------------|
| Column was visible | Column disappears |
| Column was hidden | No change (was already hidden) |
| Had custom width | Ignored (column gone) |

**Cleanup Process:**
```typescript
// On upgrade, clean orphaned references
async function cleanupOrphanedViewReferences(collectionCode: string) {
  const validProperties = await getCollectionProperties(collectionCode);
  const validCodes = validProperties.map(p => p.code);

  // Clean user preferences
  await db.query(`
    UPDATE user_view_preference
    SET delta = jsonb_strip_nulls(
      jsonb_set(
        delta,
        '{columns,hide}',
        (
          SELECT jsonb_agg(value)
          FROM jsonb_array_elements_text(delta->'columns'->'hide') AS value
          WHERE value = ANY($1)
        )
      )
    )
    WHERE collection_code = $2
  `, [validCodes, collectionCode]);
}
```

### Scenario 4: Platform Adds New Section to Detail View

**Platform Update:**
```json
// Platform adds "Commitments" section to issues detail
{
  "sections": [
    {"id": "basic", ...},
    {"id": "commitments", "title": "Commitments", ...},  // NEW
    {"id": "details", ...}
  ]
}
```

**User Experience:**

| User's Customization | What Happens |
|---------------------|--------------|
| Using platform default | Sees new section |
| Has collapsed sections list | New section visible (not in their collapsed list) |
| Using custom layout | Not affected |

---

## View Resolution Algorithm

```typescript
interface ViewResolutionResult {
  source: 'platform' | 'workspace' | 'user_preference' | 'user_custom';
  view: ComputedView;
  platformVersion: string;
  hasUnreviewedChanges: boolean;  // Platform changed since user last viewed
}

async function resolveGridView(
  collectionCode: string,
  userId: string
): Promise<ViewResolutionResult> {

  // 1. Get user's preference
  const userPref = await getUserViewPreference(userId, collectionCode, 'grid');
  const userCustom = await getUserCustomView(userId, collectionCode, 'grid');

  // 2. If user has a custom view set as default, use it
  if (userCustom?.isDefault) {
    return {
      source: 'user_custom',
      view: userCustom.definition,
      platformVersion: null,
      hasUnreviewedChanges: false
    };
  }

  // 3. Get the base view (workspace override or platform)
  const workspaceOverride = await getWorkspaceViewOverride(collectionCode, 'grid', userPref?.baseViewCode);
  const platformView = await getPlatformView(collectionCode, 'grid', userPref?.baseViewCode ?? 'default');

  // 4. Compute the final view
  let computed = platformView.definition;

  if (workspaceOverride) {
    computed = applyWorkspaceDelta(computed, workspaceOverride.delta);
  }

  if (userPref) {
    computed = applyUserDelta(computed, userPref.delta);
  }

  // 5. Check for unreviewed platform changes
  const lastSeenVersion = userPref?.lastSeenPlatformVersion;
  const hasUnreviewedChanges = lastSeenVersion && lastSeenVersion !== platformView.platformVersion;

  return {
    source: userPref ? 'user_preference' : (workspaceOverride ? 'workspace' : 'platform'),
    view: computed,
    platformVersion: platformView.platformVersion,
    hasUnreviewedChanges
  };
}
```

---

## UI for Upgrade Awareness

### "What's New" Indicator

When platform updates a view the user has customized:

```
┌─────────────────────────────────────────────────────────────────┐
│  Issues                                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Views: [All Issues ▼] [My Issues] [High Priority]             │
│         ────────────                                            │
│         │ All Issues                                            │
│         │ ✨ 2 new columns available                           │
│         │    [Review Changes]                                   │
│         └──────────────────────────────                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Review Changes Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  View Updates Available                                    ✕   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  The platform has updated the default view. Here's what's new: │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ➕ New columns available:                               │   │
│  │    • SLA Status                                         │   │
│  │    • Response Time                                      │   │
│  │                                                         │   │
│  │ ✏️ Modified:                                            │   │
│  │    • Status column width increased                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Your customizations (hidden columns, widths) will be kept.    │
│                                                                 │
│  ☐ Add new columns to my view                                  │
│  ☐ Apply width changes                                         │
│                                                                 │
│                              Dismiss    Apply Selected          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary: Upgrade Safety Rules

### ✅ Safe Operations (Never Break User Views)

1. **Adding new columns/properties** → Appear in default, users can hide
2. **Modifying column defaults** → Only affects users who haven't customized
3. **Adding new sections** → Appear in default, users can collapse
4. **Changing sort defaults** → Only affects users who haven't set custom sort

### ⚠️ Careful Operations (Handled Gracefully)

1. **Removing columns** → Disappear, orphaned refs cleaned up
2. **Renaming properties** → Migration script updates view references
3. **Changing property types** → May affect display, notify users

### 🔒 Protected (User Customizations Always Preserved)

1. **User's hidden columns** → Never unhidden by upgrades
2. **User's column widths** → Never overwritten
3. **User's custom order** → Never changed
4. **User's collapsed sections** → Never expanded
5. **User's saved filters** → Never modified
6. **User's custom views** → Never touched by platform
