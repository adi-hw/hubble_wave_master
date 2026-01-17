# Phase 2: Schema & Views - Overview

## Phase Information

| Attribute | Value |
|-----------|-------|
| Phase Number | 2 |
| Phase Name | Schema & Views |
| Timeline | Weeks 13-20 |
| Status | To Review |
| Completion | 0% |

---

## Executive Summary

Phase 2 focuses on building the advanced schema management and view configuration capabilities that enable HubbleWave to be truly metadata-driven. This phase transforms the platform from a basic CRUD application into a flexible, configurable system where administrators can define complex data structures without code changes.

---

## Key Features

### 1. Advanced Property Types

Expand beyond basic property types to support complex data modeling:

| Property Type | Description | Use Cases |
|---------------|-------------|-----------|
| Formula | Calculated values from other properties | Running totals, age calculations |
| Rollup | Aggregations from related records | Sum of line items, count of tasks |
| Lookup | Values pulled from related records | Customer name on order |
| Multi-Reference | Many-to-many relationships | Tags, categories, team members |
| Hierarchical | Self-referencing parent-child | Organization trees, task dependencies |
| Geolocation | Geographic coordinates | Asset locations, service areas |
| Rich Text | Formatted text with media | Descriptions, notes, articles |
| JSON | Structured untyped data | Integration payloads, custom fields |
| Duration | Time periods | Task estimates, SLA times |
| Currency | Monetary values with currencies | Pricing, costs, budgets |

### 2. Schema Designer

Visual interface for designing collection schemas:

- Drag-and-drop property management
- Visual relationship mapping
- Real-time validation preview
- Schema versioning and migration
- Import/export schema definitions
- Template collections

### 3. Advanced View System

Enhanced view configuration capabilities:

- Custom view layouts
- Conditional formatting
- Aggregation rows (totals, averages)
- Pivot tables
- Timeline views
- Map views
- Gallery views
- Gantt chart views

### 4. Form Builder

Configurable forms for data entry:

- Drag-and-drop form designer
- Conditional field visibility
- Multi-section layouts
- Form validation rules
- Read-only computed sections
- Embedded related records
- Mobile-optimized forms

### 5. Property Dependencies

Complex property relationships:

- Cascading choice lists
- Conditional required fields
- Cross-field validation
- Dependent default values
- Property change triggers

---

## HubbleWave vs ServiceNow

| Feature | ServiceNow | HubbleWave |
|---------|-----------|------------|
| Schema Changes | Requires admin + restart | Hot-reload, no downtime |
| Custom Fields | Complex process | Self-service with guardrails |
| Relationships | Script-based lookups | Visual relationship mapper |
| Calculated Fields | Business Rules (code) | Formula builder UI |
| View Customization | Limited presets | Fully customizable layouts |
| Form Designer | Basic drag-drop | Advanced with conditions |
| Mobile Forms | Separate configuration | Auto-responsive |
| Schema Versioning | Manual tracking | Built-in version control |

---

## Phase 2 Deliverables

### Services

| Service | Description |
|---------|-------------|
| svc-schema | Advanced schema management engine |
| svc-formula | Formula calculation service |
| svc-view-engine | Complex view rendering |

### Libraries

| Library | Description |
|---------|-------------|
| lib-schema-validator | Schema validation logic |
| lib-formula-parser | Formula parsing and evaluation |
| lib-relationship-resolver | Relationship traversal |

### UI Components

| Component | Description |
|-----------|-------------|
| SchemaDesigner | Visual schema builder |
| FormBuilder | Form layout designer |
| ViewConfigurator | View configuration interface |
| FormulaEditor | Formula builder with IntelliSense |
| RelationshipMapper | Visual relationship editor |

---

## Dependencies

### From Phase 1

- Authentication & Authorization
- Basic Collection Management
- Record CRUD Operations
- Basic View System
- Core UI Components

### External

- PostgreSQL with JSON support
- Redis for formula caching
- Elasticsearch for complex queries

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Schema changes applied | < 30 seconds |
| Formula calculation time | < 100ms for simple, < 1s for complex |
| View render with aggregations | < 500ms |
| Form builder usability | Complete form in < 5 minutes |
| Zero-downtime schema updates | 100% |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Complex formulas causing performance issues | High | Execution limits, caching, async calculation |
| Circular relationships | Medium | Dependency detection, validation |
| Schema migrations breaking data | High | Dry-run validation, rollback capability |
| View complexity overwhelming users | Medium | Progressive disclosure, templates |

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [01-IMPLEMENTATION-GUIDE.md](./01-IMPLEMENTATION-GUIDE.md) | Technical implementation details |
| [02-UI-SPECIFICATIONS.md](./02-UI-SPECIFICATIONS.md) | Design tokens and component specs |
| [03-PROTOTYPES.md](./03-PROTOTYPES.md) | Interactive wireframes |
| [04-AVA-INTEGRATION.md](./04-AVA-INTEGRATION.md) | AI assistant features |
| [05-TEST-PLAN.md](./05-TEST-PLAN.md) | Testing strategy |
| [06-INNOVATION-GUIDE.md](./06-INNOVATION-GUIDE.md) | Competitive advantages |
| [07-MOBILE-IMPLEMENTATION.md](./07-MOBILE-IMPLEMENTATION.md) | Mobile-specific features |
| [08-AVA-KNOWLEDGE-BASE.md](./08-AVA-KNOWLEDGE-BASE.md) | AVA training data |

---

*Document Version: 1.0*
*Phase Status: Planning*
*Last Updated: Phase 2 Planning*
