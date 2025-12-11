# Admin Configuration Console - Design Review & Enhancement Plan

## Executive Summary

After thoroughly analyzing your existing implementation of the Admin Configuration Console, I'm impressed with the solid foundation you've built. Your JSON-first architecture, multi-layered customization model, and upgrade-safe design patterns align well with modern enterprise platform standards. This document provides:

1. **Validation** of your current design decisions
2. **Identification of issues** and gaps
3. **Recommended enhancements**
4. **Modern UI/UX architecture** for the Admin Console
5. **Self-hosted AI integration architecture** with **Ava** (tenant-isolated, zero external calls)

---

## Part 1: Design Validation - What You Did Right

### 1.1 JSON-First Architecture ✅

Your decision to use PostgreSQL JSONB instead of XML (like ServiceNow) is excellent:

| Aspect | Your Approach | Benefit |
|--------|--------------|---------|
| Native Indexing | JSONB operators | 10-100x faster queries on config data |
| API Serialization | Native JSON | Zero conversion overhead |
| Schema Evolution | Flexible | Add fields without migrations |
| Diff Generation | RFC 6902 JSON Patch | Standard, tooling-rich |

**Validation:** This is the correct modern approach. ServiceNow's XML was a 2004 decision; JSONB is the 2025 standard.

### 1.2 Three-Tier Customization Model ✅

```
Platform → Tenant → User
```

Your `TenantCustomization` entity correctly tracks:
- `customizationType`: 'override' | 'extend' | 'new'
- `basePlatformVersion` and `baseConfigChecksum` for change detection
- `diffFromBase` using JSON Patch
- Version history with `previousVersionId`

**Validation:** This is industry-standard for upgrade-safe customization (Salesforce, ServiceNow, Oracle Cloud all use similar patterns).

### 1.3 Comprehensive Audit Trail ✅

Your `ConfigChangeHistory` entity includes:
- Full before/after values
- JSON Patch diff
- Source tracking (admin_console, api, upgrade, import)
- Rollback capability with `isRollbackable`, `rolledBackAt`
- Correlation IDs for batch operations

**Validation:** This exceeds most enterprise platforms and will be invaluable for compliance audits.

### 1.4 Event-Driven Architecture ✅

Your event system with:
- `EventDefinition` for event types
- `EventLog` for history
- `EventSubscription` for handlers
- `EventDelivery` for tracking

**Validation:** This enables loose coupling and will support AI integrations beautifully.

### 1.5 Workflow Engine Design ✅

Your workflow design supports:
- Multiple trigger types (record_event, schedule, manual, api, approval_response)
- Step-based execution with `WorkflowStepType` registry
- Canvas layout for visual designers
- Parallel branches and conditions

**Validation:** This is comparable to ServiceNow Flow Designer.

---

## Part 2: Issues & Gaps Identified

### 2.1 CRITICAL: Missing Upgrade Manifest Entity

Your `upgrade.controller.ts` uses placeholder interfaces:

```typescript
// Current: Placeholder types
interface UpgradeManifestInfo {
  id: string;
  fromVersion: string;
  // ...
}
```

**Problem:** The actual `UpgradeManifest` and `TenantUpgradeImpact` entities exist in migration but not as TypeORM entities.

**Impact:** Pre-upgrade impact analysis cannot function without these entities.

**Fix Required:** Create these TypeORM entity files:
- `libs/tenant-db/src/lib/entities/upgrade-manifest.entity.ts`
- `libs/tenant-db/src/lib/entities/tenant-upgrade-impact.entity.ts`
- `libs/tenant-db/src/lib/entities/business-rule.entity.ts`
- `libs/tenant-db/src/lib/entities/user-layout-preference.entity.ts`
- `libs/tenant-db/src/lib/entities/field-protection-rule.entity.ts`

### 2.2 HIGH: PlatformConfig Lives in Tenant Database

**Current Design:**
```typescript
// platform_config is in tenant database
const repo = await this.tenantDb.getRepository<PlatformConfig>(ctx.tenantId, PlatformConfig);
```

**Problem:** Platform configurations should be **immutable** and **identical** across all tenants. Storing them per-tenant:
1. Duplicates data across all tenant databases
2. Risks inconsistency if sync fails
3. Increases upgrade complexity

**Recommended Fix:**
- Keep `platform_config` in `eam_global` (platform database)
- Or use a shared schema that all tenant DBs can reference
- Tenant customizations still stay in tenant DB

### 2.3 HIGH: Missing Config Type Validation

Your config types are stored as strings:
```typescript
configType!: string; // 'table', 'field', 'acl', etc.
```

**Problem:** No validation that config_data matches the expected schema for that config_type.

**Recommended Enhancement:**

```typescript
// Add JSON Schema validation per config type
const CONFIG_SCHEMAS: Record<string, JSONSchema> = {
  'field': fieldConfigSchema,
  'workflow': workflowConfigSchema,
  // ...
};

// Validate on save
function validateConfigData(configType: string, configData: any): ValidationResult {
  const schema = CONFIG_SCHEMAS[configType];
  return ajv.validate(schema, configData);
}
```

### 2.4 MEDIUM: Missing Checksum Generation

Your `PlatformConfig` has a `checksum` field but no service generates it:

```typescript
checksum!: string; // SHA-256 for change detection
```

**Recommendation:**

```typescript
import { createHash } from 'crypto';

function generateConfigChecksum(configData: Record<string, any>): string {
  const normalized = JSON.stringify(configData, Object.keys(configData).sort());
  return createHash('sha256').update(normalized).digest('hex');
}
```

### 2.5 LOW: Duplicate Status Fields in Workflows

`WorkflowDefinition` has both:
```typescript
@Column({ type: 'varchar', default: 'active' })
status!: 'active' | 'inactive';

@Column({ name: 'is_active', type: 'boolean', default: true })
isActive!: boolean;
```

**Recommendation:** Pick one pattern. `isActive` boolean is simpler; `status` enum allows more states.

---

## Part 3: Modern UI/UX Architecture for Admin Console

### 3.1 Design System Foundation

Adopt a modern design system inspired by **Linear**, **Notion**, and **Vercel**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     MODERN ADMIN CONSOLE DESIGN SYSTEM                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  CORE PRINCIPLES:                                                        │
│  • Minimalist & Clean - Reduce visual clutter                           │
│  • Dark Mode First - Professional appearance, reduces eye strain        │
│  • Keyboard-First - Power users navigate without mouse                  │
│  • Contextual Actions - Actions appear when relevant                    │
│  • Instant Feedback - Every action has immediate visual response        │
│  • Progressive Disclosure - Show complexity only when needed            │
│                                                                          │
│  COLOR PALETTE (Dark Mode):                                              │
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐                 │
│  │ #0a0a│  │ #171717│  │ #262626│  │ #a3a3a3│  │ #fafafa│               │
│  │ bg-0 │  │ bg-1   │  │ bg-2   │  │ muted  │  │ text   │               │
│  └───────┘  └───────┘  └───────┘  └───────┘  └───────┘                 │
│                                                                          │
│  ACCENT COLORS:                                                          │
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐                 │
│  │ #3b82f6│ │ #22c55e│ │ #f59e0b│ │ #ef4444│ │ #8b5cf6│               │
│  │ primary│ │ success│ │ warning│ │ danger │ │ purple │               │
│  └───────┘  └───────┘  └───────┘  └───────┘  └───────┘                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Modern Admin Console Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⌘K Search...                                          [🔔] [?] [⚙️] [👤]   │
├────────┬────────────────────────────────────────────────────────────────────┤
│        │                                                                     │
│  ╭───╮ │  Admin Console                                                     │
│  │ 🏠 │ │  ─────────────────────────────────────────────────────────────    │
│  ╰───╯ │                                                                     │
│        │  ┌─────────────────────────────────────────────────────────────┐   │
│  ╭───╮ │  │                                                             │   │
│  │ 📊 │ │  │   📊 Platform Health                    ⬤ All Systems Go   │   │
│  ╰───╯ │  │                                                             │   │
│        │  │   ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │   │
│  ╭───╮ │  │   │    47     │ │    12     │ │     3     │ │     0     │  │   │
│  │ 📋 │ │  │   │ Customs   │ │ Workflows │ │  Scripts  │ │ Conflicts │  │   │
│  ╰───╯ │  │   │ ↑ 2 today │ │ ↑ 1 today │ │  Active   │ │  Great!   │  │   │
│  Tables│  │   └───────────┘ └───────────┘ └───────────┘ └───────────┘  │   │
│        │  │                                                             │   │
│  ╭───╮ │  └─────────────────────────────────────────────────────────────┘   │
│  │ ⚡ │ │                                                                     │
│  ╰───╯ │  ┌─────────────────────────────────────────────────────────────┐   │
│ Scripts│  │                                                             │   │
│        │  │   🔄 Recent Activity                              View All → │   │
│  ╭───╮ │  │                                                             │   │
│  │ 🔄 │ │  │   ┌─────────────────────────────────────────────────────┐  │   │
│  ╰───╯ │  │   │ ⚡ John modified work_order.status field     2m ago  │  │   │
│Workflows   │   │ 📋 Sarah created new approval workflow        1h ago  │  │   │
│        │  │   │ 🔄 System upgrade impact detected             3h ago  │  │   │
│  ╭───╮ │  │   │ ⚡ Mike activated business rule BR-001        1d ago  │  │   │
│  │ ✅ │ │  │   └─────────────────────────────────────────────────────┘  │   │
│  ╰───╯ │  │                                                             │   │
│Approvals   └─────────────────────────────────────────────────────────────┘   │
│        │                                                                     │
│  ╭───╮ │  ┌───────────────────────────────┐┌───────────────────────────────┐│
│  │ 🔔 │ │  │                               ││                               ││
│  ╰───╯ │  │   ⚠️ Upgrade Available        ││   ✨ Ask Ava                  ││
│Notifs  │  │                               ││                               ││
│        │  │   Version 2.6.0 is ready      ││   "How can I help you        ││
│  ╭───╮ │  │   3 customizations affected   ││    configure today?"         ││
│  │ 📈 │ │  │                               ││                               ││
│  ╰───╯ │  │   [Preview Impact] [Details]  ││   [Try: "Add a field..."]    ││
│ Events │  │                               ││                               ││
│        │  └───────────────────────────────┘└───────────────────────────────┘│
│  ╭───╮ │                                                                     │
│  │ 📜 │ │                                                                     │
│  ╰───╯ │                                                                     │
│ Rules  │                                                                     │
│        │                                                                     │
│  ╭───╮ │                                                                     │
│  │ ⬆️ │ │                                                                     │
│  ╰───╯ │                                                                     │
│Upgrade │                                                                     │
│        │                                                                     │
└────────┴────────────────────────────────────────────────────────────────────┘
```

### 3.3 Modern Component Library

#### Command Palette (⌘K)

```typescript
// apps/web-client/src/components/command-palette/CommandPalette.tsx

const commands: Command[] = [
  // Navigation
  { id: 'nav-tables', label: 'Go to Tables', icon: Table, category: 'Navigation', shortcut: 'G T' },
  { id: 'nav-scripts', label: 'Go to Scripts', icon: Code, category: 'Navigation', shortcut: 'G S' },
  { id: 'nav-workflows', label: 'Go to Workflows', icon: GitBranch, category: 'Navigation', shortcut: 'G W' },

  // Actions
  { id: 'create-field', label: 'Create Field', icon: Plus, category: 'Actions' },
  { id: 'create-script', label: 'Create Script', icon: Plus, category: 'Actions' },
  { id: 'create-workflow', label: 'Create Workflow', icon: Plus, category: 'Actions' },

  // Ava (Self-hosted AI)
  { id: 'ask-ava', label: 'Ask Ava', icon: Sparkles, category: 'Ava', shortcut: '⌘ J' },
  { id: 'ava-explain', label: 'Ava: Explain Selection', icon: HelpCircle, category: 'Ava' },

  // System
  { id: 'check-upgrade', label: 'Check for Upgrades', icon: ArrowUpCircle, category: 'System' },
  { id: 'export-config', label: 'Export Configuration', icon: Download, category: 'System' },
];
```

#### Modern Data Table Component

```typescript
// apps/web-client/src/components/data-table/ModernTable.tsx

export function ModernTable<T>({ data, columns, onRowClick, isLoading }: ModernTableProps<T>) {
  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
      {/* Header with search and filters */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              placeholder="Search..."
              className="pl-9 pr-4 py-1.5 bg-neutral-800 text-white placeholder-neutral-500 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <button className="flex items-center space-x-2 px-3 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
            <Plus className="h-4 w-4" />
            <span>Add New</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-800">
            {columns.map(col => (
              <th key={col.id} className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                <button className="flex items-center space-x-1 hover:text-neutral-300 transition-colors">
                  <span>{col.header}</span>
                  <ChevronsUpDown className="h-3 w-3" />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800/50">
          {data.map((row, idx) => (
            <tr
              key={idx}
              onClick={() => onRowClick?.(row)}
              className="hover:bg-neutral-800/50 cursor-pointer transition-colors"
            >
              {columns.map(col => (
                <td key={col.id} className="px-4 py-3 text-sm text-neutral-300">
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

#### Status Badge Component

```typescript
// apps/web-client/src/components/ui/StatusBadge.tsx

type Status = 'platform' | 'override' | 'extend' | 'custom' | 'conflict' | 'locked';

const statusConfig: Record<Status, { bg: string; text: string; dot: string; label: string }> = {
  platform: { bg: 'bg-neutral-800', text: 'text-neutral-300', dot: 'bg-neutral-400', label: 'Platform' },
  override: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400', label: 'Override' },
  extend: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400', label: 'Extended' },
  custom: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-400', label: 'Custom' },
  conflict: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400 animate-pulse', label: 'Conflict' },
  locked: { bg: 'bg-neutral-700', text: 'text-neutral-400', dot: 'bg-neutral-500', label: 'Locked' },
};

export const StatusBadge: React.FC<{ status: Status }> = ({ status }) => {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
};
```

### 3.4 Recommended UI Dependencies

```json
{
  "dependencies": {
    "framer-motion": "^11.0.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-tooltip": "^1.0.7",
    "@tanstack/react-table": "^8.11.0",
    "@tanstack/react-virtual": "^3.0.1",
    "cmdk": "^0.2.0",
    "@monaco-editor/react": "^4.6.0",
    "lucide-react": "^0.309.0",
    "react-hook-form": "^7.49.0",
    "@hookform/resolvers": "^3.3.2",
    "zod": "^3.22.4"
  }
}
```

---

## Part 4: Self-Hosted AI - Ava (Tenant-Isolated)

### 4.1 Ava - Your Platform's AI Assistant

**Ava** is HubbleWave's self-hosted AI assistant that runs entirely within your infrastructure with complete tenant isolation.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AVA - SELF-HOSTED AI ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  CORE PRINCIPLES:                                                        │
│  ✅ Zero external API calls - All AI runs inside your infrastructure   │
│  ✅ Per-tenant isolation - Each tenant has own vector store & policies │
│  ✅ No cross-tenant access - Complete data separation                   │
│  ✅ PHI-safe - No data leaves your infrastructure                       │
│  ✅ Audit trail - All Ava interactions logged per tenant                │
│                                                                          │
│  COMPONENTS:                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  svc-ai    │  │   Ollama    │  │ pgvector OR │  │  Bull/Redis │    │
│  │  (NestJS)  │  │   Runner    │  │   Qdrant    │  │  Job Queue  │    │
│  │   "Ava"    │  │ (Llama.cpp) │  │(per-tenant) │  │             │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Ava Service Architecture

```
apps/svc-ai/                              # Ava AI Service
├── src/
│   ├── main.ts                           # Service entry point
│   ├── app/
│   │   ├── app.module.ts                 # Main module
│   │   │
│   │   ├── inference/                    # LLM Inference Module
│   │   │   ├── inference.module.ts
│   │   │   ├── inference.service.ts      # Ollama/Llama.cpp interface
│   │   │   └── inference.controller.ts
│   │   │
│   │   ├── embeddings/                   # Embedding Generation Module
│   │   │   ├── embeddings.module.ts
│   │   │   ├── embeddings.service.ts     # Generate embeddings
│   │   │   └── embeddings.processor.ts   # Bull queue processor
│   │   │
│   │   ├── vector-store/                 # Vector Storage Module
│   │   │   ├── vector-store.module.ts
│   │   │   ├── pgvector.service.ts       # Option 1: pgvector
│   │   │   ├── qdrant.service.ts         # Option 2: Qdrant
│   │   │   └── vector-store.interface.ts
│   │   │
│   │   ├── rag/                          # RAG Pipeline Module
│   │   │   ├── rag.module.ts
│   │   │   ├── rag.service.ts            # Retrieval-Augmented Gen
│   │   │   ├── context-builder.ts        # Build context from vectors
│   │   │   └── prompt-templates.ts       # Ava's prompts
│   │   │
│   │   ├── policies/                     # AI Access Policies Module
│   │   │   ├── policies.module.ts
│   │   │   ├── policies.service.ts       # Per-tenant AI policies
│   │   │   └── entities/
│   │   │       ├── ai-policy.entity.ts   # What Ava can access
│   │   │       └── ai-audit-log.entity.ts# Ava interaction audit
│   │   │
│   │   ├── indexing/                     # Record Indexing Module
│   │   │   ├── indexing.module.ts
│   │   │   ├── indexing.service.ts       # Index records on change
│   │   │   ├── indexing.listener.ts      # Event-driven indexing
│   │   │   └── field-extractor.ts        # Extract indexable fields
│   │   │
│   │   └── ava/                          # Ava Chat Module
│   │       ├── ava.module.ts
│   │       ├── ava.controller.ts         # Chat API endpoints
│   │       ├── ava.service.ts            # Ava business logic
│   │       └── intents/                  # Intent handlers
│   │           ├── config-explain.ts
│   │           ├── script-generate.ts
│   │           ├── workflow-design.ts
│   │           └── upgrade-analyze.ts
│   │
│   └── config/
│       └── ai.config.ts                  # AI configuration
│
├── project.json                          # Nx project config
└── tsconfig.app.json
```

### 4.3 Database Schema for Ava (Per-Tenant)

```sql
-- ========== AVA POLICIES (Per-Tenant) ==========
-- Controls what Ava can access and do for each tenant

CREATE TABLE ava_policy (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL,

    -- Policy scope
    policy_type varchar(50) NOT NULL,  -- 'field_access', 'workflow_trigger', 'form_assist', 'search'

    -- Field access policies
    table_code varchar(100),
    allowed_fields varchar(100)[],     -- Fields Ava can read
    denied_fields varchar(100)[],      -- Fields Ava cannot read (PHI, secrets)

    -- Workflow trigger policies
    allowed_workflow_codes varchar(100)[], -- Workflows Ava can trigger

    -- Form assist policies
    allowed_form_codes varchar(100)[],     -- Forms Ava can help with

    -- Search policies
    allowed_search_tables varchar(100)[],  -- Tables Ava can search

    is_enabled boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ava_policy_tenant ON ava_policy(tenant_id, policy_type);

-- ========== AVA AUDIT LOG (Per-Tenant) ==========
-- Every Ava interaction is logged for compliance

CREATE TABLE ava_audit_log (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,

    -- Request details
    request_type varchar(50) NOT NULL,  -- 'chat', 'explain', 'generate', 'search'
    request_content text NOT NULL,      -- User's query (sanitized)
    request_context jsonb,              -- Additional context provided

    -- Response details
    response_content text,              -- Ava's response
    response_metadata jsonb,            -- Model used, tokens, etc.

    -- RAG details
    retrieved_documents jsonb,          -- What was retrieved for context
    retrieval_scores float[],           -- Relevance scores

    -- Policy enforcement
    policies_applied uuid[],            -- Which policies were checked
    fields_redacted varchar(100)[],     -- Fields that were redacted

    -- Performance
    latency_ms int,

    -- Status
    status varchar(20) NOT NULL,        -- 'success', 'blocked', 'error'
    error_message text,

    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ava_audit_tenant ON ava_audit_log(tenant_id, created_at DESC);

-- ========== VECTOR STORE (pgvector - Per-Tenant) ==========

CREATE TABLE tenant_vectors (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL,

    -- Source record
    source_table varchar(100) NOT NULL,
    source_record_id uuid NOT NULL,
    chunk_index int DEFAULT 0,

    -- Vector content
    content text NOT NULL,
    embedding vector(1536) NOT NULL,

    -- Metadata
    metadata jsonb DEFAULT '{}',

    indexed_at timestamptz DEFAULT now(),
    source_updated_at timestamptz
);

CREATE INDEX idx_tenant_vectors_tenant ON tenant_vectors(tenant_id);
CREATE INDEX idx_tenant_vectors_source ON tenant_vectors(source_table, source_record_id);

-- HNSW index for fast similarity search
CREATE INDEX idx_tenant_vectors_embedding ON tenant_vectors
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ========== AVA INDEXING RULES (Per-Tenant) ==========

CREATE TABLE ava_indexing_rule (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL,

    table_code varchar(100) NOT NULL,
    indexed_fields jsonb NOT NULL,      -- [{ field: 'description', weight: 1.0 }, ...]

    chunk_strategy varchar(30) DEFAULT 'paragraph',
    chunk_size int DEFAULT 500,
    chunk_overlap int DEFAULT 50,

    index_condition jsonb,
    trigger_on_change boolean DEFAULT true,
    reindex_interval_hours int,

    is_enabled boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(tenant_id, table_code)
);
```

### 4.4 Ava Service Implementation

#### RAG Service with Tenant Isolation

```typescript
// apps/svc-ai/src/app/rag/rag.service.ts

@Injectable()
export class RAGService {
  constructor(
    private readonly vectorStore: VectorStoreInterface,
    private readonly inference: InferenceService,
    private readonly policies: AvaPoliciesService,
    private readonly auditLog: AvaAuditLogService,
  ) {}

  async query(
    tenantId: string,
    userId: string,
    query: string,
    options?: RAGOptions,
  ): Promise<RAGResponse> {
    const startTime = Date.now();

    // 1. Check Ava policies for this tenant/user
    const allowedTables = await this.policies.getAllowedSearchTables(tenantId, userId);
    const deniedFields = await this.policies.getDeniedFields(tenantId, userId);

    // 2. Generate query embedding (local)
    const queryEmbedding = await this.inference.embed(query);

    // 3. Search vector store (tenant-isolated)
    const retrievedDocs = await this.vectorStore.search(tenantId, queryEmbedding, {
      filterTables: allowedTables,
      limit: options?.topK || 5,
    });

    // 4. Redact denied fields from retrieved documents
    const redactedDocs = this.redactFields(retrievedDocs, deniedFields);

    // 5. Build context and generate response (local LLM)
    const context = this.buildContext(redactedDocs);
    const systemPrompt = this.buildAvaPrompt(options?.intent);

    const response = await this.inference.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}` },
    ]);

    // 6. Log the interaction (compliance)
    await this.auditLog.log({
      tenantId,
      userId,
      requestType: options?.intent || 'chat',
      requestContent: query,
      responseContent: response.message.content,
      retrievedDocuments: retrievedDocs.map(d => ({
        table: d.source_table,
        recordId: d.source_record_id,
      })),
      fieldsRedacted: deniedFields,
      latencyMs: Date.now() - startTime,
      status: 'success',
    });

    return {
      answer: response.message.content,
      sources: redactedDocs,
    };
  }

  private buildAvaPrompt(intent?: string): string {
    return `You are Ava, an AI assistant for the HubbleWave Enterprise Asset Management platform.
You help administrators configure the system, explain settings, and answer questions.
Always base your answers on the provided context. If the context doesn't contain
the information needed, say so clearly.

Be helpful, concise, and professional.`;
  }
}
```

#### Ava Controller

```typescript
// apps/svc-ai/src/app/ava/ava.controller.ts

@Controller('ava')
@UseGuards(JwtAuthGuard)
export class AvaController {
  constructor(
    private readonly ava: AvaService,
    private readonly rag: RAGService,
  ) {}

  @Post('chat')
  async chat(
    @Body() body: ChatRequestDto,
    @Req() req: any,
  ): Promise<ChatResponseDto> {
    const ctx = req.context;

    // Process through RAG pipeline with tenant isolation
    const response = await this.rag.query(
      ctx.tenantId,
      ctx.userId,
      body.message,
      {
        intent: body.intent,
        topK: body.topK,
        conversationHistory: body.history,
      },
    );

    return {
      message: response.answer,
      sources: response.sources.map(s => ({
        table: s.source_table,
        recordId: s.source_record_id,
        snippet: s.content.slice(0, 200),
        relevance: s.similarity,
      })),
    };
  }

  @Post('explain')
  async explain(
    @Body() body: ExplainRequestDto,
    @Req() req: any,
  ): Promise<ExplainResponseDto> {
    return this.ava.explainConfig(
      req.context.tenantId,
      req.context.userId,
      body.configType,
      body.resourceKey,
    );
  }

  @Post('generate-script')
  async generateScript(
    @Body() body: GenerateScriptDto,
    @Req() req: any,
  ): Promise<GenerateScriptResponseDto> {
    return this.ava.generateScript(
      req.context.tenantId,
      req.context.userId,
      body.description,
      body.targetTable,
      body.scriptType,
    );
  }
}
```

### 4.5 Ava Chat Widget

```typescript
// apps/web-client/src/components/ava/AvaChat.tsx

export const AvaChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const { mutate: sendMessage, isLoading } = useAvaMutation();

  return (
    <>
      {/* Ava Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-full shadow-lg transition-all hover:scale-105"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {/* Ava Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed bottom-24 right-6 w-96 h-[500px] bg-neutral-900 rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-gradient-to-r from-violet-600/10 to-purple-600/10">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Ava</div>
                  <div className="text-xs text-neutral-500">Your AI Assistant</div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-violet-600/20 to-purple-600/20 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-8 w-8 text-violet-400" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-1">Hi, I'm Ava</h3>
                  <p className="text-sm text-neutral-400 mb-4">
                    How can I help you configure today?
                  </p>
                  <div className="space-y-2">
                    {[
                      'Add a required field to work orders',
                      'Create an approval workflow',
                      'Explain this ACL configuration',
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setInput(suggestion)}
                        className="block w-full px-3 py-2 text-xs text-left text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                      >
                        "{suggestion}"
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-md bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center mr-2 flex-shrink-0">
                        <Sparkles className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-white animate-pulse" />
                  </div>
                  <div className="text-sm text-neutral-400">Ava is thinking...</div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-neutral-800">
              <div className="flex items-center space-x-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Ava anything..."
                  className="flex-1 px-4 py-2 bg-neutral-800 text-white placeholder-neutral-500 rounded-lg outline-none focus:ring-2 focus:ring-violet-500/50"
                  onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="p-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-lg transition-all"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
```

### 4.6 Docker Compose for Ava

```yaml
# docker-compose.yml additions

services:
  # Local LLM inference with Ollama
  eam_ollama:
    image: ollama/ollama:latest
    container_name: eam_ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    # For GPU acceleration (NVIDIA):
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

  # Optional: Qdrant for vector storage (alternative to pgvector)
  eam_qdrant:
    image: qdrant/qdrant:latest
    container_name: eam_qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  ollama_data:
  qdrant_data:
```

---

## Part 5: Implementation Priorities

### Phase 1: Critical Backend Fixes (Week 1-2)
1. Create missing TypeORM entities (UpgradeManifest, BusinessRule, etc.)
2. Add checksum generation for platform configs
3. Fix platform config storage location decision
4. Add config type validation

### Phase 2: Modern UI Foundation (Week 3-4)
1. Set up design system with dark mode
2. Implement Command Palette (⌘K)
3. Create modern table component with @tanstack/react-table
4. Update color scheme and typography

### Phase 3: Admin Console Modernization (Week 5-6)
1. Redesign Customizations List page
2. Implement modern Diff Viewer
3. Add status badges and indicators
4. Implement split-pane layouts

### Phase 4: Ava Infrastructure (Week 7-8)
1. Create svc-ai NestJS service
2. Set up Ollama with preferred model (Llama 2, Mistral, etc.)
3. Add pgvector extension to tenant databases
4. Create Ava policy and audit log tables

### Phase 5: Ava Features (Week 9-10)
1. Implement RAG pipeline with tenant isolation
2. Build event-driven indexing
3. Create Ava chat widget
4. Add config explanation and script generation

### Phase 6: Polish (Week 11-12)
1. Animation and transitions
2. Keyboard navigation
3. Performance optimization
4. Comprehensive testing
5. Ava policy admin UI

---

## Conclusion

Your Admin Configuration Console design is fundamentally sound and follows enterprise best practices. The main improvements needed are:

1. **Backend Fixes** - Create missing entities, fix platform config storage
2. **Modern UI** - Adopt dark-mode-first, keyboard-friendly design inspired by Linear/Vercel
3. **Ava** - Self-hosted AI assistant with per-tenant isolation and zero external calls

Your architecture with Ava is ideal for healthcare/enterprise:
- **Zero PHI leakage** - All processing stays on your infrastructure
- **No cross-tenant contamination** - Each tenant has isolated vectors and policies
- **Compliance-friendly** - Full audit trail of all Ava interactions
- **No external API calls** - Ollama/Llama.cpp runs locally

The combination of modern UI and Ava will make your platform highly competitive while maintaining the security and compliance requirements of healthcare and enterprise customers.
