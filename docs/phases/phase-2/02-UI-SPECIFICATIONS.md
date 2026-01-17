# Phase 2: UI Specifications

## Design Philosophy

### Core Principles
1. **No Hardcoded Values**: Every visual property uses design tokens
2. **Theme-Agnostic Components**: Components work in any theme context
3. **Accessibility-First**: WCAG 2.1 AAA as the baseline
4. **Progressive Disclosure**: Complex features revealed as needed
5. **Configuration Through UI**: Zero code required for customization

---

## 1. Design Token System Extensions

### 1.1 Advanced Color Tokens

```css
/* Phase 2 semantic color additions */
:root[data-theme="light"] {
  /* Canvas and design surfaces */
  --hw-surface-canvas: var(--hw-color-neutral-25);
  --hw-surface-panel: var(--hw-color-neutral-0);
  --hw-surface-elevated-high: var(--hw-color-neutral-0);
  --hw-surface-sunken: var(--hw-color-neutral-100);

  /* Property type colors */
  --hw-property-text: oklch(60% 0.12 220);
  --hw-property-number: oklch(60% 0.14 160);
  --hw-property-date: oklch(60% 0.13 280);
  --hw-property-choice: oklch(60% 0.15 40);
  --hw-property-reference: oklch(60% 0.13 320);
  --hw-property-formula: oklch(60% 0.16 50);
  --hw-property-user: oklch(60% 0.12 260);
  --hw-property-attachment: oklch(60% 0.14 180);

  /* View type indicators */
  --hw-view-list: oklch(60% 0.12 220);
  --hw-view-kanban: oklch(60% 0.14 280);
  --hw-view-calendar: oklch(60% 0.13 40);
  --hw-view-timeline: oklch(60% 0.15 160);
  --hw-view-map: oklch(60% 0.14 120);
  --hw-view-pivot: oklch(60% 0.13 320);

  /* Drag and drop states */
  --hw-dnd-dragging: oklch(from var(--hw-interactive-primary) l c h / 0.3);
  --hw-dnd-drop-zone: oklch(from var(--hw-interactive-primary) l c h / 0.1);
  --hw-dnd-drop-active: oklch(from var(--hw-interactive-primary) l c h / 0.2);
  --hw-dnd-forbidden: oklch(from var(--hw-status-error) l c h / 0.1);

  /* Formula editor syntax highlighting */
  --hw-syntax-keyword: oklch(55% 0.18 280);
  --hw-syntax-function: oklch(55% 0.16 220);
  --hw-syntax-string: oklch(55% 0.14 140);
  --hw-syntax-number: oklch(55% 0.15 40);
  --hw-syntax-operator: oklch(50% 0.12 320);
  --hw-syntax-property: oklch(60% 0.14 260);
  --hw-syntax-comment: var(--hw-content-tertiary);
  --hw-syntax-error: var(--hw-status-error);
}

:root[data-theme="dark"] {
  /* Canvas and design surfaces */
  --hw-surface-canvas: var(--hw-color-neutral-975);
  --hw-surface-panel: var(--hw-color-neutral-900);
  --hw-surface-elevated-high: var(--hw-color-neutral-850);
  --hw-surface-sunken: var(--hw-color-neutral-925);

  /* Property type colors (adjusted for dark mode) */
  --hw-property-text: oklch(70% 0.12 220);
  --hw-property-number: oklch(70% 0.14 160);
  --hw-property-date: oklch(70% 0.13 280);
  --hw-property-choice: oklch(70% 0.15 40);
  --hw-property-reference: oklch(70% 0.13 320);
  --hw-property-formula: oklch(70% 0.16 50);
  --hw-property-user: oklch(70% 0.12 260);
  --hw-property-attachment: oklch(70% 0.14 180);

  /* View type indicators */
  --hw-view-list: oklch(70% 0.12 220);
  --hw-view-kanban: oklch(70% 0.14 280);
  --hw-view-calendar: oklch(70% 0.13 40);
  --hw-view-timeline: oklch(70% 0.15 160);
  --hw-view-map: oklch(70% 0.14 120);
  --hw-view-pivot: oklch(70% 0.13 320);

  /* Formula editor syntax highlighting */
  --hw-syntax-keyword: oklch(70% 0.18 280);
  --hw-syntax-function: oklch(70% 0.16 220);
  --hw-syntax-string: oklch(70% 0.14 140);
  --hw-syntax-number: oklch(70% 0.15 40);
  --hw-syntax-operator: oklch(65% 0.12 320);
  --hw-syntax-property: oklch(75% 0.14 260);
}
```

### 1.2 Z-Index Scale

```css
:root {
  /* Z-index management system */
  --hw-z-base: 0;
  --hw-z-dropdown: 1000;
  --hw-z-sticky: 1100;
  --hw-z-fixed: 1200;
  --hw-z-modal-backdrop: 1300;
  --hw-z-modal: 1400;
  --hw-z-popover: 1500;
  --hw-z-tooltip: 1600;
  --hw-z-notification: 1700;
  --hw-z-debug: 9999;
}
```

### 1.3 Grid and Layout Tokens

```css
:root {
  /* Grid system */
  --hw-grid-columns: 12;
  --hw-grid-gutter: var(--hw-space-4);
  --hw-grid-margin: var(--hw-space-6);

  /* Container widths */
  --hw-container-xs: 320px;
  --hw-container-sm: 640px;
  --hw-container-md: 768px;
  --hw-container-lg: 1024px;
  --hw-container-xl: 1280px;
  --hw-container-2xl: 1536px;
  --hw-container-full: 100%;

  /* Designer canvas dimensions */
  --hw-designer-sidebar-width: 280px;
  --hw-designer-properties-width: 320px;
  --hw-designer-toolbar-height: 56px;
  --hw-designer-canvas-padding: var(--hw-space-8);

  /* Form builder dimensions */
  --hw-form-builder-palette-width: 280px;
  --hw-form-builder-properties-width: 360px;
  --hw-form-builder-canvas-max-width: 800px;
}
```

---

## 2. Component Specifications

### 2.1 Schema Designer Components

#### Property Type Selector

```tsx
interface PropertyTypeSelectorProps {
  selectedType?: PropertyType;
  onChange: (type: PropertyType) => void;
  disabled?: boolean;
}

const propertyTypeStyles = {
  container: `
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--hw-space-3);
  `,

  typeCard: `
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--hw-space-2);
    padding: var(--hw-space-4);
    background: var(--hw-surface-primary);
    border: 2px solid var(--hw-border-default);
    border-radius: var(--hw-radius-lg);
    cursor: pointer;
    transition: var(--hw-transition-colors);

    &:hover:not(:disabled) {
      background: var(--hw-surface-secondary);
      border-color: var(--hw-border-strong);
    }

    &[data-selected="true"] {
      background: oklch(from var(--hw-interactive-primary) l c h / 0.1);
      border-color: var(--hw-interactive-primary);
      border-width: 2px;
    }

    &:focus-visible {
      outline: none;
      box-shadow: var(--hw-shadow-focus);
    }
  `,

  typeIcon: `
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--hw-radius-md);
    font-size: var(--hw-font-size-xl);

    &[data-type="text"] {
      background: oklch(from var(--hw-property-text) l c h / 0.15);
      color: var(--hw-property-text);
    }

    &[data-type="number"] {
      background: oklch(from var(--hw-property-number) l c h / 0.15);
      color: var(--hw-property-number);
    }

    &[data-type="date"],
    &[data-type="datetime"] {
      background: oklch(from var(--hw-property-date) l c h / 0.15);
      color: var(--hw-property-date);
    }

    &[data-type="choice"],
    &[data-type="multi-choice"] {
      background: oklch(from var(--hw-property-choice) l c h / 0.15);
      color: var(--hw-property-choice);
    }

    &[data-type="reference"],
    &[data-type="multi-reference"] {
      background: oklch(from var(--hw-property-reference) l c h / 0.15);
      color: var(--hw-property-reference);
    }

    &[data-type="formula"],
    &[data-type="rollup"],
    &[data-type="lookup"] {
      background: oklch(from var(--hw-property-formula) l c h / 0.15);
      color: var(--hw-property-formula);
    }

    &[data-type="user"],
    &[data-type="multi-user"] {
      background: oklch(from var(--hw-property-user) l c h / 0.15);
      color: var(--hw-property-user);
    }
  `,

  typeLabel: `
    color: var(--hw-content-primary);
    font-size: var(--hw-font-size-sm);
    font-weight: var(--hw-font-weight-medium);
    text-align: center;
  `,

  typeDescription: `
    color: var(--hw-content-tertiary);
    font-size: var(--hw-font-size-xs);
    text-align: center;
    margin-top: var(--hw-space-1);
  `,
};
```

#### Property Configuration Panel

```tsx
interface PropertyConfigPanelProps {
  property: PropertyDefinition;
  schema: CollectionSchema;
  onChange: (property: PropertyDefinition) => void;
  onClose: () => void;
}

const propertyConfigStyles = {
  panel: `
    width: var(--hw-designer-properties-width);
    height: 100%;
    background: var(--hw-surface-primary);
    border-left: 1px solid var(--hw-border-default);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `,

  header: `
    padding: var(--hw-space-4);
    border-bottom: 1px solid var(--hw-border-default);
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,

  content: `
    flex: 1;
    overflow-y: auto;
    padding: var(--hw-space-4);
  `,

  section: `
    margin-bottom: var(--hw-space-6);

    &:last-child {
      margin-bottom: 0;
    }
  `,

  sectionTitle: `
    color: var(--hw-content-secondary);
    font-size: var(--hw-font-size-xs);
    font-weight: var(--hw-font-weight-semibold);
    letter-spacing: var(--hw-letter-spacing-wider);
    text-transform: uppercase;
    margin-bottom: var(--hw-space-3);
  `,

  fieldGroup: `
    display: flex;
    flex-direction: column;
    gap: var(--hw-space-4);
  `,

  footer: `
    padding: var(--hw-space-4);
    border-top: 1px solid var(--hw-border-default);
    display: flex;
    gap: var(--hw-space-2);
    justify-content: flex-end;
  `,
};
```

#### Relationship Mapper

```tsx
interface RelationshipMapperProps {
  schemas: CollectionSchema[];
  relationships: Relationship[];
  onAddRelationship: (relationship: Relationship) => void;
  onRemoveRelationship: (id: string) => void;
}

const relationshipMapperStyles = {
  canvas: `
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--hw-surface-canvas);
    background-image:
      linear-gradient(var(--hw-border-subtle) 1px, transparent 1px),
      linear-gradient(90deg, var(--hw-border-subtle) 1px, transparent 1px);
    background-size: 20px 20px;
  `,

  collectionNode: `
    position: absolute;
    background: var(--hw-surface-primary);
    border: 2px solid var(--hw-border-default);
    border-radius: var(--hw-radius-lg);
    box-shadow: var(--hw-shadow-md);
    min-width: 200px;
    cursor: move;

    &:hover {
      border-color: var(--hw-border-strong);
      box-shadow: var(--hw-shadow-lg);
    }

    &[data-selected="true"] {
      border-color: var(--hw-interactive-primary);
      box-shadow: var(--hw-shadow-focus), var(--hw-shadow-lg);
    }
  `,

  nodeHeader: `
    padding: var(--hw-space-3) var(--hw-space-4);
    background: var(--hw-surface-secondary);
    border-bottom: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-lg) var(--hw-radius-lg) 0 0;
    display: flex;
    align-items: center;
    gap: var(--hw-space-2);
  `,

  nodeBody: `
    padding: var(--hw-space-2);
    max-height: 300px;
    overflow-y: auto;
  `,

  property: `
    padding: var(--hw-space-2) var(--hw-space-3);
    display: flex;
    align-items: center;
    gap: var(--hw-space-2);
    border-radius: var(--hw-radius-sm);
    font-size: var(--hw-font-size-sm);

    &:hover {
      background: var(--hw-surface-secondary);
    }

    &[data-reference="true"] {
      cursor: pointer;
      color: var(--hw-property-reference);
    }
  `,

  relationshipLine: `
    stroke: var(--hw-border-strong);
    stroke-width: 2px;
    fill: none;

    &[data-type="one-to-many"] {
      stroke-dasharray: none;
    }

    &[data-type="many-to-many"] {
      stroke-dasharray: 5, 5;
    }

    &:hover {
      stroke: var(--hw-interactive-primary);
      stroke-width: 3px;
    }
  `,

  relationshipLabel: `
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-sm);
    padding: var(--hw-space-1) var(--hw-space-2);
    font-size: var(--hw-font-size-xs);
    color: var(--hw-content-secondary);
    pointer-events: none;
  `,
};
```

### 2.2 Form Builder Components

#### Form Section

```tsx
interface FormSectionProps {
  section: FormSection;
  schema: CollectionSchema;
  isEditing: boolean;
  onUpdate: (section: FormSection) => void;
  onDelete: () => void;
}

const formSectionStyles = {
  container: `
    background: var(--hw-surface-primary);
    border: 2px dashed var(--hw-border-default);
    border-radius: var(--hw-radius-lg);
    padding: var(--hw-space-4);
    margin-bottom: var(--hw-space-4);
    transition: var(--hw-transition-colors);

    &[data-editing="true"] {
      border-style: solid;
      border-color: var(--hw-interactive-primary);
      box-shadow: var(--hw-shadow-focus);
    }

    &[data-dragging="true"] {
      opacity: 0.5;
      border-color: var(--hw-dnd-dragging);
    }

    &[data-drop-zone="true"] {
      background: var(--hw-dnd-drop-zone);
      border-color: var(--hw-interactive-primary);
    }
  `,

  header: `
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--hw-space-3);
    cursor: move;

    &:hover .form-section__actions {
      opacity: 1;
    }
  `,

  title: `
    font-size: var(--hw-font-size-lg);
    font-weight: var(--hw-font-weight-semibold);
    color: var(--hw-content-primary);
  `,

  description: `
    color: var(--hw-content-secondary);
    font-size: var(--hw-font-size-sm);
    margin-bottom: var(--hw-space-3);
  `,

  fields: `
    display: grid;
    gap: var(--hw-space-4);

    &[data-layout="single-column"] {
      grid-template-columns: 1fr;
    }

    &[data-layout="two-column"] {
      grid-template-columns: repeat(2, 1fr);
    }

    &[data-layout="grid"] {
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    }
  `,

  actions: `
    display: flex;
    gap: var(--hw-space-2);
    opacity: 0;
    transition: var(--hw-transition-opacity);
  `,
};
```

#### Form Field Editor

```tsx
interface FormFieldEditorProps {
  field: FormField;
  property: PropertyDefinition;
  onUpdate: (field: FormField) => void;
  onDelete: () => void;
}

const formFieldStyles = {
  container: `
    background: var(--hw-surface-secondary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-md);
    padding: var(--hw-space-3);
    cursor: move;
    transition: var(--hw-transition-all);

    &:hover {
      border-color: var(--hw-border-strong);
      box-shadow: var(--hw-shadow-sm);
    }

    &[data-selected="true"] {
      border-color: var(--hw-interactive-primary);
      box-shadow: var(--hw-shadow-focus);
    }

    &[data-readonly="true"]::after {
      content: 'Read Only';
      position: absolute;
      top: var(--hw-space-2);
      right: var(--hw-space-2);
      padding: var(--hw-space-1) var(--hw-space-2);
      background: var(--hw-surface-tertiary);
      color: var(--hw-content-secondary);
      font-size: var(--hw-font-size-xs);
      border-radius: var(--hw-radius-sm);
    }

    &[data-required="true"]::before {
      content: '*';
      position: absolute;
      top: var(--hw-space-2);
      left: var(--hw-space-2);
      color: var(--hw-status-error);
      font-size: var(--hw-font-size-lg);
      font-weight: var(--hw-font-weight-bold);
    }
  `,

  fieldHeader: `
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--hw-space-2);
  `,

  fieldLabel: `
    display: flex;
    align-items: center;
    gap: var(--hw-space-2);
    color: var(--hw-content-primary);
    font-size: var(--hw-font-size-sm);
    font-weight: var(--hw-font-weight-medium);
  `,

  propertyType: `
    display: inline-flex;
    align-items: center;
    gap: var(--hw-space-1);
    padding: var(--hw-space-1) var(--hw-space-2);
    background: var(--hw-surface-tertiary);
    border-radius: var(--hw-radius-sm);
    font-size: var(--hw-font-size-xs);
    color: var(--hw-content-secondary);
  `,

  widgetPreview: `
    padding: var(--hw-space-2);
    background: var(--hw-surface-primary);
    border: 1px dashed var(--hw-border-subtle);
    border-radius: var(--hw-radius-sm);
    font-size: var(--hw-font-size-sm);
    color: var(--hw-content-tertiary);
  `,
};
```

### 2.3 Formula Editor Components

#### Formula Editor with IntelliSense

```tsx
interface FormulaEditorProps {
  value: string;
  schema: CollectionSchema;
  resultType: 'text' | 'number' | 'date' | 'boolean';
  onChange: (value: string) => void;
  onValidate?: (valid: boolean, errors?: string[]) => void;
}

const formulaEditorStyles = {
  container: `
    display: flex;
    flex-direction: column;
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-lg);
    overflow: hidden;
  `,

  toolbar: `
    display: flex;
    align-items: center;
    gap: var(--hw-space-2);
    padding: var(--hw-space-2) var(--hw-space-3);
    background: var(--hw-surface-secondary);
    border-bottom: 1px solid var(--hw-border-default);
  `,

  editor: `
    position: relative;
    min-height: 200px;
    font-family: var(--hw-font-family-mono);
    font-size: var(--hw-font-size-sm);
    line-height: var(--hw-line-height-relaxed);
    padding: var(--hw-space-3);
    background: var(--hw-surface-primary);
    color: var(--hw-content-primary);
    resize: vertical;
    border: none;
    outline: none;

    &:focus {
      background: var(--hw-surface-primary);
    }
  `,

  lineNumbers: `
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 40px;
    padding: var(--hw-space-3) var(--hw-space-2);
    background: var(--hw-surface-secondary);
    border-right: 1px solid var(--hw-border-subtle);
    color: var(--hw-content-tertiary);
    font-family: var(--hw-font-family-mono);
    font-size: var(--hw-font-size-sm);
    text-align: right;
    user-select: none;
    pointer-events: none;
  `,

  syntaxHighlight: `
    .keyword {
      color: var(--hw-syntax-keyword);
      font-weight: var(--hw-font-weight-semibold);
    }

    .function {
      color: var(--hw-syntax-function);
      font-weight: var(--hw-font-weight-medium);
    }

    .string {
      color: var(--hw-syntax-string);
    }

    .number {
      color: var(--hw-syntax-number);
    }

    .operator {
      color: var(--hw-syntax-operator);
    }

    .property {
      color: var(--hw-syntax-property);
    }

    .comment {
      color: var(--hw-syntax-comment);
      font-style: italic;
    }

    .error {
      color: var(--hw-syntax-error);
      text-decoration: wavy underline var(--hw-status-error);
    }
  `,

  autocomplete: `
    position: absolute;
    background: var(--hw-surface-elevated);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-md);
    box-shadow: var(--hw-shadow-lg);
    max-height: 300px;
    min-width: 200px;
    overflow-y: auto;
    z-index: var(--hw-z-popover);
  `,

  autocompleteItem: `
    display: flex;
    align-items: center;
    gap: var(--hw-space-2);
    padding: var(--hw-space-2) var(--hw-space-3);
    cursor: pointer;

    &[data-selected="true"] {
      background: var(--hw-interactive-secondary);
    }

    &:hover {
      background: var(--hw-interactive-secondary-hover);
    }
  `,

  autocompleteIcon: `
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--hw-radius-sm);
    font-size: var(--hw-font-size-xs);

    &[data-type="function"] {
      background: oklch(from var(--hw-syntax-function) l c h / 0.15);
      color: var(--hw-syntax-function);
    }

    &[data-type="property"] {
      background: oklch(from var(--hw-syntax-property) l c h / 0.15);
      color: var(--hw-syntax-property);
    }

    &[data-type="keyword"] {
      background: oklch(from var(--hw-syntax-keyword) l c h / 0.15);
      color: var(--hw-syntax-keyword);
    }
  `,

  autocompleteLabel: `
    flex: 1;
    color: var(--hw-content-primary);
    font-size: var(--hw-font-size-sm);
    font-family: var(--hw-font-family-mono);
  `,

  autocompleteDescription: `
    color: var(--hw-content-tertiary);
    font-size: var(--hw-font-size-xs);
  `,

  statusBar: `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--hw-space-2) var(--hw-space-3);
    background: var(--hw-surface-secondary);
    border-top: 1px solid var(--hw-border-default);
    font-size: var(--hw-font-size-xs);
    color: var(--hw-content-secondary);
  `,

  validationStatus: `
    display: flex;
    align-items: center;
    gap: var(--hw-space-2);

    &[data-valid="true"] {
      color: var(--hw-status-success);
    }

    &[data-valid="false"] {
      color: var(--hw-status-error);
    }
  `,
};
```

### 2.4 View Type Components

#### Kanban Board

```tsx
interface KanbanViewProps {
  config: KanbanViewConfig;
  records: FormattedRecord[];
  schema: CollectionSchema;
  onRecordMove: (recordId: string, toColumn: string) => void;
  onRecordClick: (record: FormattedRecord) => void;
}

const kanbanStyles = {
  board: `
    display: flex;
    gap: var(--hw-space-4);
    height: 100%;
    overflow-x: auto;
    padding: var(--hw-space-4);
    background: var(--hw-surface-canvas);
  `,

  column: `
    display: flex;
    flex-direction: column;
    min-width: 280px;
    max-width: 320px;
    flex-shrink: 0;
    background: var(--hw-surface-secondary);
    border-radius: var(--hw-radius-lg);
    overflow: hidden;
  `,

  columnHeader: `
    padding: var(--hw-space-3) var(--hw-space-4);
    background: var(--hw-surface-primary);
    border-bottom: 1px solid var(--hw-border-default);
    position: sticky;
    top: 0;
    z-index: var(--hw-z-sticky);
  `,

  columnTitle: `
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: var(--hw-font-weight-semibold);
    color: var(--hw-content-primary);
  `,

  columnCount: `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 var(--hw-space-2);
    background: var(--hw-surface-tertiary);
    border-radius: var(--hw-radius-full);
    font-size: var(--hw-font-size-xs);
    font-weight: var(--hw-font-weight-medium);
    color: var(--hw-content-secondary);
  `,

  wipLimit: `
    margin-top: var(--hw-space-1);
    padding: var(--hw-space-1) var(--hw-space-2);
    background: var(--hw-status-warning-subtle);
    border-radius: var(--hw-radius-sm);
    font-size: var(--hw-font-size-xs);
    color: var(--hw-status-warning);

    &[data-exceeded="true"] {
      background: var(--hw-status-error-subtle);
      color: var(--hw-status-error);
    }
  `,

  columnBody: `
    flex: 1;
    overflow-y: auto;
    padding: var(--hw-space-3);
    display: flex;
    flex-direction: column;
    gap: var(--hw-space-3);

    &[data-drop-zone="true"] {
      background: var(--hw-dnd-drop-active);
    }
  `,

  card: `
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-md);
    padding: var(--hw-space-3);
    cursor: grab;
    transition: var(--hw-transition-all);

    &:hover {
      border-color: var(--hw-border-strong);
      box-shadow: var(--hw-shadow-md);
    }

    &:active {
      cursor: grabbing;
    }

    &[data-dragging="true"] {
      opacity: 0.5;
      transform: rotate(2deg);
    }
  `,

  cardHeader: `
    margin-bottom: var(--hw-space-2);
  `,

  cardTitle: `
    font-weight: var(--hw-font-weight-medium);
    color: var(--hw-content-primary);
    margin-bottom: var(--hw-space-1);
  `,

  cardProperties: `
    display: flex;
    flex-direction: column;
    gap: var(--hw-space-2);
  `,

  cardProperty: `
    display: flex;
    align-items: center;
    gap: var(--hw-space-2);
    font-size: var(--hw-font-size-sm);
  `,

  cardPropertyLabel: `
    color: var(--hw-content-tertiary);
    font-size: var(--hw-font-size-xs);
  `,

  cardPropertyValue: `
    color: var(--hw-content-secondary);
  `,

  cardFooter: `
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: var(--hw-space-2);
    padding-top: var(--hw-space-2);
    border-top: 1px solid var(--hw-border-subtle);
  `,

  swimlane: `
    margin-bottom: var(--hw-space-6);

    &:last-child {
      margin-bottom: 0;
    }
  `,

  swimlaneHeader: `
    padding: var(--hw-space-2) var(--hw-space-3);
    background: var(--hw-surface-tertiary);
    border-radius: var(--hw-radius-md);
    margin-bottom: var(--hw-space-3);
    font-weight: var(--hw-font-weight-semibold);
  `,
};
```

#### Calendar View

```tsx
interface CalendarViewProps {
  config: CalendarViewConfig;
  records: FormattedRecord[];
  schema: CollectionSchema;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onRecordClick: (record: FormattedRecord) => void;
}

const calendarStyles = {
  container: `
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--hw-surface-primary);
  `,

  toolbar: `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--hw-space-3) var(--hw-space-4);
    border-bottom: 1px solid var(--hw-border-default);
  `,

  navigation: `
    display: flex;
    align-items: center;
    gap: var(--hw-space-2);
  `,

  currentPeriod: `
    font-size: var(--hw-font-size-lg);
    font-weight: var(--hw-font-weight-semibold);
    color: var(--hw-content-primary);
    min-width: 200px;
    text-align: center;
  `,

  viewSwitcher: `
    display: flex;
    gap: var(--hw-space-1);
    padding: var(--hw-space-1);
    background: var(--hw-surface-secondary);
    border-radius: var(--hw-radius-md);
  `,

  monthView: `
    flex: 1;
    display: flex;
    flex-direction: column;
  `,

  weekDayHeader: `
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: var(--hw-surface-secondary);
    border-bottom: 1px solid var(--hw-border-default);
  `,

  weekDay: `
    padding: var(--hw-space-2);
    text-align: center;
    font-size: var(--hw-font-size-sm);
    font-weight: var(--hw-font-weight-semibold);
    color: var(--hw-content-secondary);
    text-transform: uppercase;
    letter-spacing: var(--hw-letter-spacing-wide);
  `,

  monthGrid: `
    flex: 1;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: repeat(6, 1fr);
    gap: 1px;
    background: var(--hw-border-subtle);
  `,

  day: `
    background: var(--hw-surface-primary);
    padding: var(--hw-space-2);
    min-height: 100px;
    overflow-y: auto;

    &[data-other-month="true"] {
      background: var(--hw-surface-secondary);
      opacity: 0.6;
    }

    &[data-today="true"] {
      background: oklch(from var(--hw-interactive-primary) l c h / 0.05);
      border: 2px solid var(--hw-interactive-primary);
    }

    &[data-selected="true"] {
      background: oklch(from var(--hw-interactive-primary) l c h / 0.1);
    }

    &:hover {
      background: var(--hw-surface-secondary);
    }
  `,

  dayNumber: `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin-bottom: var(--hw-space-1);
    border-radius: var(--hw-radius-full);
    font-weight: var(--hw-font-weight-medium);
    color: var(--hw-content-primary);

    &[data-today="true"] {
      background: var(--hw-interactive-primary);
      color: var(--hw-content-inverse);
    }
  `,

  events: `
    display: flex;
    flex-direction: column;
    gap: var(--hw-space-1);
  `,

  event: `
    padding: var(--hw-space-1) var(--hw-space-2);
    border-radius: var(--hw-radius-sm);
    font-size: var(--hw-font-size-xs);
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: var(--hw-transition-colors);

    &:hover {
      opacity: 0.8;
      box-shadow: var(--hw-shadow-sm);
    }
  `,

  weekView: `
    flex: 1;
    display: grid;
    grid-template-columns: 60px repeat(7, 1fr);
    overflow-y: auto;
  `,

  timeSlot: `
    border-bottom: 1px solid var(--hw-border-subtle);
    padding: var(--hw-space-1) var(--hw-space-2);
    font-size: var(--hw-font-size-xs);
    color: var(--hw-content-tertiary);
    text-align: right;
  `,

  dayColumn: `
    border-left: 1px solid var(--hw-border-subtle);
    position: relative;

    &[data-today="true"] {
      background: oklch(from var(--hw-interactive-primary) l c h / 0.03);
    }
  `,

  timedEvent: `
    position: absolute;
    left: 2px;
    right: 2px;
    border-radius: var(--hw-radius-sm);
    padding: var(--hw-space-1) var(--hw-space-2);
    font-size: var(--hw-font-size-xs);
    cursor: pointer;
    overflow: hidden;
    box-shadow: var(--hw-shadow-sm);

    &:hover {
      box-shadow: var(--hw-shadow-md);
      z-index: calc(var(--hw-z-base) + 1);
    }
  `,
};
```

#### Timeline View

```tsx
interface TimelineViewProps {
  config: TimelineViewConfig;
  records: FormattedRecord[];
  schema: CollectionSchema;
  viewStart: Date;
  viewEnd: Date;
  onRangeChange: (start: Date, end: Date) => void;
}

const timelineStyles = {
  container: `
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--hw-surface-primary);
  `,

  toolbar: `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--hw-space-3) var(--hw-space-4);
    background: var(--hw-surface-secondary);
    border-bottom: 1px solid var(--hw-border-default);
  `,

  timelineContent: `
    flex: 1;
    display: flex;
    overflow: hidden;
  `,

  groupsColumn: `
    width: 200px;
    background: var(--hw-surface-secondary);
    border-right: 1px solid var(--hw-border-default);
    overflow-y: auto;
  `,

  groupHeader: `
    padding: var(--hw-space-3) var(--hw-space-4);
    border-bottom: 1px solid var(--hw-border-subtle);
    font-weight: var(--hw-font-weight-semibold);
    background: var(--hw-surface-tertiary);
    position: sticky;
    top: 0;
    z-index: var(--hw-z-sticky);
  `,

  group: `
    padding: var(--hw-space-3) var(--hw-space-4);
    border-bottom: 1px solid var(--hw-border-subtle);
    min-height: 60px;
    display: flex;
    align-items: center;
  `,

  chartArea: `
    flex: 1;
    overflow: auto;
    position: relative;
  `,

  timeAxis: `
    height: 48px;
    background: var(--hw-surface-secondary);
    border-bottom: 1px solid var(--hw-border-default);
    position: sticky;
    top: 0;
    z-index: var(--hw-z-sticky);
    display: flex;
  `,

  timeMarker: `
    flex: 1;
    border-right: 1px solid var(--hw-border-subtle);
    padding: var(--hw-space-2);
    text-align: center;
    font-size: var(--hw-font-size-xs);
    color: var(--hw-content-secondary);

    &[data-major="true"] {
      font-weight: var(--hw-font-weight-semibold);
      border-right-width: 2px;
      border-right-color: var(--hw-border-default);
    }
  `,

  rows: `
    position: relative;
  `,

  row: `
    height: 60px;
    border-bottom: 1px solid var(--hw-border-subtle);
    position: relative;

    &:hover {
      background: var(--hw-surface-secondary);
    }
  `,

  gridLines: `
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    pointer-events: none;
  `,

  gridLine: `
    flex: 1;
    border-right: 1px solid var(--hw-border-subtle);

    &[data-major="true"] {
      border-right-width: 2px;
      border-right-color: var(--hw-border-default);
    }
  `,

  bar: `
    position: absolute;
    height: 32px;
    top: 50%;
    transform: translateY(-50%);
    border-radius: var(--hw-radius-md);
    padding: 0 var(--hw-space-2);
    display: flex;
    align-items: center;
    font-size: var(--hw-font-size-sm);
    font-weight: var(--hw-font-weight-medium);
    cursor: pointer;
    box-shadow: var(--hw-shadow-sm);
    transition: var(--hw-transition-all);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      box-shadow: var(--hw-shadow-md);
      z-index: calc(var(--hw-z-base) + 1);
    }

    &[data-selected="true"] {
      outline: 2px solid var(--hw-border-focus);
      outline-offset: 2px;
      z-index: calc(var(--hw-z-base) + 2);
    }
  `,

  milestone: `
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 16px;
    height: 16px;
    border-radius: var(--hw-radius-sm);
    transform: rotate(45deg);
    cursor: pointer;
    box-shadow: var(--hw-shadow-md);

    &:hover {
      transform: rotate(45deg) scale(1.2);
    }
  `,

  dependency: `
    stroke: var(--hw-content-tertiary);
    stroke-width: 2px;
    fill: none;
    marker-end: url(#arrow);

    &:hover {
      stroke: var(--hw-interactive-primary);
      stroke-width: 3px;
    }
  `,

  todayLine: `
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--hw-status-error);
    pointer-events: none;
    z-index: calc(var(--hw-z-base) + 10);

    &::before {
      content: 'Today';
      position: absolute;
      top: -24px;
      left: 50%;
      transform: translateX(-50%);
      padding: var(--hw-space-1) var(--hw-space-2);
      background: var(--hw-status-error);
      color: var(--hw-content-inverse);
      font-size: var(--hw-font-size-xs);
      border-radius: var(--hw-radius-sm);
      white-space: nowrap;
    }
  `,
};
```

#### Map View

```tsx
interface MapViewProps {
  config: MapViewConfig;
  records: FormattedRecord[];
  schema: CollectionSchema;
  onRecordClick: (record: FormattedRecord) => void;
}

const mapViewStyles = {
  container: `
    position: relative;
    width: 100%;
    height: 100%;
  `,

  map: `
    width: 100%;
    height: 100%;
  `,

  controls: `
    position: absolute;
    top: var(--hw-space-4);
    right: var(--hw-space-4);
    display: flex;
    flex-direction: column;
    gap: var(--hw-space-2);
    z-index: var(--hw-z-fixed);
  `,

  controlButton: `
    width: 40px;
    height: 40px;
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: var(--hw-shadow-md);
    transition: var(--hw-transition-all);

    &:hover {
      background: var(--hw-surface-secondary);
      box-shadow: var(--hw-shadow-lg);
    }

    &:active {
      transform: scale(0.95);
    }
  `,

  marker: `
    width: 32px;
    height: 32px;
    background: var(--hw-interactive-primary);
    border: 3px solid var(--hw-surface-primary);
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: var(--hw-shadow-lg);
    cursor: pointer;
    transition: var(--hw-transition-transform);

    &::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 8px;
      height: 8px;
      background: var(--hw-surface-primary);
      border-radius: var(--hw-radius-full);
    }

    &:hover {
      transform: rotate(-45deg) scale(1.2);
      z-index: calc(var(--hw-z-base) + 1);
    }

    &[data-selected="true"] {
      background: var(--hw-status-error);
      z-index: calc(var(--hw-z-base) + 2);
    }
  `,

  cluster: `
    width: 48px;
    height: 48px;
    background: var(--hw-interactive-primary);
    border: 3px solid var(--hw-surface-primary);
    border-radius: var(--hw-radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--hw-content-inverse);
    font-size: var(--hw-font-size-sm);
    font-weight: var(--hw-font-weight-bold);
    box-shadow: var(--hw-shadow-lg);
    cursor: pointer;
    transition: var(--hw-transition-transform);

    &:hover {
      transform: scale(1.1);
    }
  `,

  popup: `
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-lg);
    padding: var(--hw-space-3);
    min-width: 200px;
    max-width: 300px;
    box-shadow: var(--hw-shadow-xl);
  `,

  popupTitle: `
    font-weight: var(--hw-font-weight-semibold);
    color: var(--hw-content-primary);
    margin-bottom: var(--hw-space-2);
  `,

  popupContent: `
    display: flex;
    flex-direction: column;
    gap: var(--hw-space-2);
  `,

  popupProperty: `
    display: flex;
    justify-content: space-between;
    gap: var(--hw-space-2);
    font-size: var(--hw-font-size-sm);
  `,

  popupLabel: `
    color: var(--hw-content-tertiary);
  `,

  popupValue: `
    color: var(--hw-content-primary);
    font-weight: var(--hw-font-weight-medium);
  `,

  legend: `
    position: absolute;
    bottom: var(--hw-space-4);
    left: var(--hw-space-4);
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-lg);
    padding: var(--hw-space-3);
    max-width: 300px;
    box-shadow: var(--hw-shadow-md);
    z-index: var(--hw-z-fixed);
  `,

  legendTitle: `
    font-weight: var(--hw-font-weight-semibold);
    margin-bottom: var(--hw-space-2);
  `,

  legendItems: `
    display: flex;
    flex-direction: column;
    gap: var(--hw-space-2);
  `,

  legendItem: `
    display: flex;
    align-items: center;
    gap: var(--hw-space-2);
    font-size: var(--hw-font-size-sm);
  `,
};
```

#### Pivot Table

```tsx
interface PivotTableProps {
  config: PivotViewConfig;
  data: PivotData;
  schema: CollectionSchema;
  onCellClick?: (cell: PivotCell) => void;
}

const pivotStyles = {
  container: `
    width: 100%;
    height: 100%;
    overflow: auto;
    background: var(--hw-surface-primary);
  `,

  table: `
    border-collapse: separate;
    border-spacing: 0;
    font-size: var(--hw-font-size-sm);
    width: 100%;
  `,

  headerCell: `
    background: var(--hw-surface-secondary);
    border: 1px solid var(--hw-border-default);
    padding: var(--hw-space-2) var(--hw-space-3);
    font-weight: var(--hw-font-weight-semibold);
    color: var(--hw-content-primary);
    text-align: left;
    position: sticky;
    z-index: var(--hw-z-sticky);

    &[data-sticky-column="true"] {
      left: 0;
      z-index: calc(var(--hw-z-sticky) + 1);
    }

    &[data-sticky-row="true"] {
      top: 0;
    }

    &[data-sticky-corner="true"] {
      top: 0;
      left: 0;
      z-index: calc(var(--hw-z-sticky) + 2);
    }
  `,

  rowHeaderCell: `
    background: var(--hw-surface-secondary);
    border: 1px solid var(--hw-border-default);
    padding: var(--hw-space-2) var(--hw-space-3);
    font-weight: var(--hw-font-weight-medium);
    position: sticky;
    left: 0;
    z-index: var(--hw-z-sticky);

    &[data-level="0"] {
      padding-left: var(--hw-space-3);
    }

    &[data-level="1"] {
      padding-left: var(--hw-space-6);
    }

    &[data-level="2"] {
      padding-left: var(--hw-space-8);
    }
  `,

  dataCell: `
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-subtle);
    padding: var(--hw-space-2) var(--hw-space-3);
    text-align: right;
    color: var(--hw-content-primary);
    cursor: pointer;
    transition: var(--hw-transition-colors);

    &:hover {
      background: var(--hw-surface-secondary);
    }

    &[data-total="true"] {
      background: var(--hw-surface-tertiary);
      font-weight: var(--hw-font-weight-semibold);
    }

    &[data-grand-total="true"] {
      background: var(--hw-interactive-secondary);
      font-weight: var(--hw-font-weight-bold);
      border: 2px solid var(--hw-border-strong);
    }
  `,

  expandButton: `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    margin-right: var(--hw-space-2);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-sm);
    background: var(--hw-surface-primary);
    cursor: pointer;
    transition: var(--hw-transition-colors);

    &:hover {
      background: var(--hw-surface-tertiary);
    }

    &[data-expanded="true"] {
      transform: rotate(90deg);
    }
  `,
};
```

---

## 3. Layout Patterns

### 3.1 Schema Designer Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Toolbar                                                         [Save]  │
├────────────┬────────────────────────────────────────────┬───────────────┤
│            │                                            │               │
│  Property  │           Schema Canvas                    │  Properties   │
│  Palette   │                                            │     Panel     │
│            │  ┌──────────────────────────────────────┐  │               │
│ ┌────────┐ │  │  Collection: Incidents               │  │ ┌───────────┐ │
│ │ Text   │ │  │  ─────────────────────────────────── │  │ │ Property  │ │
│ │ Number │ │  │                                      │  │ │ Config    │ │
│ │ Date   │ │  │  Properties:                         │  │ │           │ │
│ │ Choice │ │  │                                      │  │ │ Name:     │ │
│ │ Ref.   │ │  │  □ ID          (Auto Number)        │  │ │ [...]     │ │
│ │ Formula│ │  │  □ Title       (Text)      *        │  │ │           │ │
│ │ Rollup │ │  │  □ Description (Long Text)          │  │ │ Type:     │ │
│ │ User   │ │  │  □ Priority    (Choice)    *        │  │ │ [Text ▼] │ │
│ │ Attach │ │  │  □ Status      (Choice)    *        │  │ │           │ │
│ └────────┘ │  │  □ Assigned    (Reference) *        │  │ │ Required  │ │
│            │  │  □ Created     (DateTime)           │  │ │ [✓]       │ │
│ + Add      │  │  □ Updated     (DateTime)           │  │ │           │ │
│   Property │  │                                      │  │ │ Default:  │ │
│            │  │  [+ Add Property]                    │  │ │ [...]     │ │
│ ┌────────┐ │  │                                      │  │ │           │ │
│ │ Validat│ │  │  Relationships:                      │  │ │ [Delete]  │ │
│ │ -ion   │ │  │                                      │  │ │ [Save]    │ │
│ │ Rules  │ │  │  Assigned → Users (Many-to-One)      │  │ └───────────┘ │
│ └────────┘ │  │  Tasks ← Incidents (One-to-Many)     │  │               │
│            │  │                                      │  │               │
│            │  │  [+ Add Relationship]                │  │               │
│            │  │                                      │  │               │
│            │  └──────────────────────────────────────┘  │               │
│            │                                            │               │
└────────────┴────────────────────────────────────────────┴───────────────┘
```

### 3.2 Form Builder Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Edit ▼] Form: Create Incident                      [Preview] [Save]   │
├────────────┬────────────────────────────────────────────┬───────────────┤
│            │                                            │               │
│  Elements  │           Form Canvas                      │  Field        │
│  Palette   │                                            │  Properties   │
│            │  ┌──────────────────────────────────────┐  │               │
│ PROPERTIES │  │  Section: Basic Information     [⋮]  │  │ ┌───────────┐ │
│ ┌────────┐ │  │  ─────────────────────────────────── │  │ │ Selected  │ │
│ │ Title  │ │  │                                      │  │ │ Field:    │ │
│ │ Desc.  │ │  │  [Title *              ]             │  │ │ Title     │ │
│ │ Priority│ │  │  Short description of the incident   │  │ │           │ │
│ │ Status │ │  │                                      │  │ │ Label:    │ │
│ │ Assigned│ │  │  [Description          ]             │  │ │ [Title]   │ │
│ └────────┘ │  │  ┌────────────────────┐              │  │ │           │ │
│            │  │  │                    │              │  │ │ Widget:   │ │
│ LAYOUT     │  │  │                    │              │  │ │ [Text ▼]  │ │
│ ┌────────┐ │  │  └────────────────────┘              │  │ │           │ │
│ │ Section│ │  │                                      │  │ │ Width:    │ │
│ │ Divider│ │  │  [Priority ▼]      [Status ▼]        │  │ │ • Full    │ │
│ │ Spacer │ │  │  High/Medium/Low   New/Open/Closed   │  │ │ ○ Half    │ │
│ │ Text   │ │  │                                      │  │ │           │ │
│ └────────┘ │  │  Section: Assignment           [⋮]  │  │ │ Required  │ │
│            │  │  ─────────────────────────────────── │  │ │ [✓]       │ │
│ RELATED    │  │                                      │  │ │           │ │
│ ┌────────┐ │  │  [Assigned To      ▼]                │  │ │ Help Text │ │
│ │ Tasks  │ │  │  Search users...                     │  │ │ [...]     │ │
│ │ Comments│ │  │                                      │  │ │           │ │
│ │ Related│ │  │  [Assignment Group ▼]                │  │ │ Condition │ │
│ └────────┘ │  │  IT Support                          │  │ │ [+ Add]   │ │
│            │  │                                      │  │ │           │ │
│            │  │  [+ Add Section]                     │  │ └───────────┘ │
│            │  │                                      │  │               │
│            │  └──────────────────────────────────────┘  │               │
│            │                                            │               │
└────────────┴────────────────────────────────────────────┴───────────────┘
```

### 3.3 View Configurator Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Configure View: Incidents Kanban                         [Save] [Cancel]│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─ Basic Settings ────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  View Name: [Incidents Kanban                            ]      │   │
│  │  View Type: [Kanban ▼]                                          │   │
│  │  Visibility: • Personal  ○ Shared  ○ Public                     │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ Kanban Configuration ──────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  Column Property: [Status                               ▼]      │   │
│  │  Card Properties:                                               │   │
│  │  ☑ Title         ☑ Priority      ☑ Assigned To                 │   │
│  │  □ Description   □ Created       □ Updated                      │   │
│  │                                                                  │   │
│  │  Swimlane Property: [Assignment Group                   ▼]      │   │
│  │  Show empty columns: [✓]                                        │   │
│  │                                                                  │   │
│  │  WIP Limits:                                                    │   │
│  │  New: [10]  In Progress: [5]  Awaiting: [3]  Resolved: [∞]     │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ Filters ───────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  Match [All ▼] of the following:                                │   │
│  │                                                                  │   │
│  │  [Priority     ▼] [equals      ▼] [High           ▼]  [×]      │   │
│  │  [Created      ▼] [in last     ▼] [30 days        ▼]  [×]      │   │
│  │                                                                  │   │
│  │  [+ Add Filter Condition]                                       │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ Conditional Formatting ────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  ┌────────────────────────────────────────────────────────────┐ │   │
│  │  │ High Priority Items                               [Edit] [×]│ │   │
│  │  │ When: Priority = High                                       │ │   │
│  │  │ Style: 🟥 Red background                                    │ │   │
│  │  └────────────────────────────────────────────────────────────┘ │   │
│  │                                                                  │   │
│  │  [+ Add Formatting Rule]                                        │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ Preview ───────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  [Live preview of configured view...]                           │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Accessibility Requirements

### 4.1 Keyboard Navigation

```yaml
Schema Designer:
  - Tab: Navigate between properties, toolbar, panels
  - Arrow Keys: Navigate property list
  - Enter: Edit selected property
  - Delete/Backspace: Remove selected property
  - Escape: Close panels/modals
  - Ctrl+S: Save schema
  - Ctrl+Z: Undo
  - Ctrl+Y: Redo

Form Builder:
  - Tab: Navigate between sections and fields
  - Arrow Keys: Navigate within sections
  - Ctrl+Arrow Keys: Reorder fields
  - Enter: Edit selected field
  - Delete: Remove selected field
  - Escape: Close property panel
  - Space: Toggle section collapse

Formula Editor:
  - Tab: Accept autocomplete suggestion
  - Ctrl+Space: Trigger autocomplete
  - Arrow Keys: Navigate autocomplete list
  - Enter: Accept suggestion and continue
  - Escape: Close autocomplete
  - Ctrl+/: Comment/uncomment line

View Configurator:
  - Tab: Navigate between configuration sections
  - Enter: Edit configuration value
  - Space: Toggle checkboxes
  - Escape: Cancel and close
```

### 4.2 Screen Reader Support

```html
<!-- Property in Schema Designer -->
<div
  role="listitem"
  aria-label="Property: Title, Type: Text, Required"
  tabindex="0"
  data-property-id="title"
>
  <span aria-hidden="true">📝</span>
  <span>Title</span>
  <span class="sr-only">Text property, required field</span>
</div>

<!-- Form Section -->
<section
  aria-labelledby="section-basic"
  data-section-id="basic"
>
  <h3 id="section-basic">Basic Information</h3>
  <p id="section-basic-desc">Essential incident details</p>
  <div
    role="group"
    aria-labelledby="section-basic"
    aria-describedby="section-basic-desc"
  >
    <!-- Fields -->
  </div>
</section>

<!-- Kanban Column -->
<div
  role="region"
  aria-label="Status: In Progress, 5 items, WIP limit 8"
  data-column="in_progress"
>
  <h3 id="column-in-progress">In Progress</h3>
  <span class="sr-only">5 of 8 items (WIP limit not exceeded)</span>
  <div
    role="list"
    aria-labelledby="column-in-progress"
  >
    <!-- Cards -->
  </div>
</div>

<!-- Formula Editor -->
<div
  role="textbox"
  aria-label="Formula editor"
  aria-multiline="true"
  aria-describedby="formula-help"
  contenteditable="true"
  spellcheck="false"
>
  <!-- Editor content -->
</div>
<div id="formula-help" class="sr-only">
  Use Ctrl+Space for autocomplete. Available functions: SUM, AVERAGE, IF, etc.
</div>

<!-- Autocomplete -->
<div
  role="listbox"
  aria-label="Formula suggestions"
  id="autocomplete-list"
>
  <div
    role="option"
    aria-selected="true"
    id="suggestion-1"
  >
    <span class="sr-only">Function:</span> SUM
    <span class="sr-only">Sum of numeric values</span>
  </div>
</div>
```

### 4.3 Focus Management

```typescript
// Focus trap in modals
function trapFocus(container: HTMLElement) {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  container.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  });

  // Focus first element when modal opens
  firstElement.focus();
}

// Restore focus after modal closes
function saveFocusState(): () => void {
  const activeElement = document.activeElement as HTMLElement;

  return () => {
    if (activeElement && typeof activeElement.focus === 'function') {
      activeElement.focus();
    }
  };
}
```

### 4.4 ARIA Live Regions

```html
<!-- Schema validation feedback -->
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
>
  Schema saved successfully. Version 2.3 created.
</div>

<!-- Formula validation -->
<div
  role="alert"
  aria-live="assertive"
  aria-atomic="true"
  class="sr-only"
>
  Formula error: Circular dependency detected in property "total_amount"
</div>

<!-- Drag and drop feedback -->
<div
  role="status"
  aria-live="polite"
  aria-atomic="false"
>
  <span>Property "Title" moved to position 2 of 8</span>
</div>

<!-- View update notification -->
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  Kanban view updated. Showing 23 items across 4 columns.
</div>
```

### 4.5 Color Contrast Validation

```typescript
// Minimum contrast ratios (WCAG 2.1 AAA)
const contrastRequirements = {
  normalText: {
    minimum: 7.0,    // AAA level
    enhanced: 7.0,
  },
  largeText: {      // 18px+ or 14px+ bold
    minimum: 4.5,    // AAA level
    enhanced: 4.5,
  },
  uiComponents: {
    minimum: 3.0,    // AA level (AAA not defined)
    enhanced: 3.0,
  },
};

// All token combinations must meet these requirements
// Validated in design system tests
```

---

## 5. Responsive Behavior

### 5.1 Schema Designer Breakpoints

```css
/* Desktop (default) */
.schema-designer {
  grid-template-columns: var(--hw-designer-sidebar-width) 1fr var(--hw-designer-properties-width);
}

/* Tablet (< 1024px) */
@media (max-width: 1023px) {
  .schema-designer {
    grid-template-columns: 1fr var(--hw-designer-properties-width);
  }

  .schema-designer__palette {
    position: fixed;
    left: -280px;
    transition: var(--hw-transition-transform);
  }

  .schema-designer__palette[data-open="true"] {
    left: 0;
    box-shadow: var(--hw-shadow-2xl);
  }
}

/* Mobile (< 768px) */
@media (max-width: 767px) {
  .schema-designer {
    grid-template-columns: 1fr;
  }

  .schema-designer__properties {
    position: fixed;
    right: -100%;
    top: 0;
    bottom: 0;
    width: 100%;
    max-width: 400px;
    transition: var(--hw-transition-transform);
  }

  .schema-designer__properties[data-open="true"] {
    right: 0;
  }
}
```

### 5.2 Form Builder Mobile Adaptations

```css
/* Mobile form builder stacks vertically */
@media (max-width: 767px) {
  .form-builder {
    display: flex;
    flex-direction: column;
  }

  .form-builder__palette,
  .form-builder__properties {
    position: fixed;
    bottom: -100%;
    left: 0;
    right: 0;
    height: 60vh;
    transition: var(--hw-transition-transform);
    border-top: 1px solid var(--hw-border-default);
    box-shadow: 0 -4px 12px var(--hw-surface-overlay);
  }

  .form-builder__palette[data-open="true"],
  .form-builder__properties[data-open="true"] {
    bottom: 0;
  }

  /* Form canvas takes full width */
  .form-builder__canvas {
    padding: var(--hw-space-4);
  }

  /* Two-column layouts become single column */
  .form-section__fields[data-layout="two-column"] {
    grid-template-columns: 1fr;
  }
}
```

### 5.3 View Type Mobile Behavior

```css
/* Kanban on mobile: horizontal scroll with snap */
@media (max-width: 767px) {
  .kanban-board {
    scroll-snap-type: x mandatory;
    padding: var(--hw-space-2);
  }

  .kanban-column {
    scroll-snap-align: start;
    min-width: 90vw;
    max-width: 90vw;
  }
}

/* Calendar on mobile: week/day view only */
@media (max-width: 767px) {
  .calendar-view[data-view="month"] {
    display: none;
  }

  .calendar-view[data-view="week"],
  .calendar-view[data-view="day"] {
    display: flex;
  }
}

/* Timeline on mobile: vertical layout */
@media (max-width: 767px) {
  .timeline-content {
    flex-direction: column;
  }

  .timeline-groups-column {
    width: 100%;
    max-height: 200px;
  }

  .timeline-chart-area {
    width: 100%;
    overflow-x: scroll;
  }
}

/* Pivot table: freeze first column */
@media (max-width: 767px) {
  .pivot-table {
    font-size: var(--hw-font-size-xs);
  }

  .pivot-table__row-header {
    position: sticky;
    left: 0;
    min-width: 120px;
    box-shadow: 2px 0 4px var(--hw-surface-overlay);
  }
}
```

---

*Document Version: 1.0*
*Phase Status: Planning*
*Last Updated: Phase 2 Planning*
