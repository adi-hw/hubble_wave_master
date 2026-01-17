# Phase 3: UI Specifications

**Document Type:** Design Specification
**Audience:** UI/UX Designers & Frontend Developers
**Status:** Planning Phase

## Table of Contents

1. [Design Principles](#design-principles)
2. [Component Specifications](#component-specifications)
3. [Design Tokens](#design-tokens)
4. [User Flows](#user-flows)
5. [Accessibility Requirements](#accessibility-requirements)
6. [Responsive Design](#responsive-design)

---

## Design Principles

### 1. Visual Clarity
- **No-Code Visual Language:** Every automation rule should be understandable at a glance
- **Progressive Disclosure:** Show simple options first, reveal advanced features on demand
- **Visual Hierarchy:** Use size, color, and spacing to guide users through complex interfaces

### 2. Guided Experience
- **Contextual Help:** Inline help text and tooltips throughout the builder
- **Smart Defaults:** Pre-fill common values and patterns
- **Validation Feedback:** Real-time validation with clear error messages

### 3. Consistency
- **Design System Alignment:** All components use HubbleWave design tokens
- **Pattern Reuse:** Consistent patterns across all automation builders
- **Terminology:** Use platform terminology (Collection, Property, Record, Instance)

---

## Component Specifications

### 1. Business Rule Builder

#### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Business Rule Builder                                      [X]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Rule Name                                           [Active] │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Auto-assign Critical Incidents                          │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ WHEN                                                         │ │
│ │ ┌─────────────────┐  ┌─────────────────┐                   │ │
│ │ │ Record is       │  │ Before          │                   │ │
│ │ │ [created ▼]     │  │ [operation ▼]   │                   │ │
│ │ └─────────────────┘  └─────────────────┘                   │ │
│ │                                                              │ │
│ │ on collection: Incident                                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ IF (Conditions)                                              │ │
│ │                                                              │ │
│ │ ┌──────────────────────────────────────────────────────────┐│ │
│ │ │ [Priority ▼] [equals ▼] [Critical]           [x]        ││ │
│ │ │                                                           ││ │
│ │ │        AND                                                ││ │
│ │ │                                                           ││ │
│ │ │ [Assignment Group ▼] [is empty ▼]            [x]        ││ │
│ │ └──────────────────────────────────────────────────────────┘│ │
│ │                                                              │ │
│ │ [+ Add Condition] [+ Add Group]                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ THEN (Actions)                                               │ │
│ │                                                              │ │
│ │ ┌──────────────────────────────────────────────────────────┐│ │
│ │ │ 1. Set Property                                   [↕] [x]││ │
│ │ │    Property: [Assignment Group ▼]                        ││ │
│ │ │    Value:    [Network Operations]                        ││ │
│ │ └──────────────────────────────────────────────────────────┘│ │
│ │                                                              │ │
│ │ ┌──────────────────────────────────────────────────────────┐│ │
│ │ │ 2. Send Notification                              [↕] [x]││ │
│ │ │    Type:    [Email ▼]                                    ││ │
│ │ │    To:      [Assignment Group Manager]                   ││ │
│ │ │    Subject: [Critical Incident Assigned]                 ││ │
│ │ └──────────────────────────────────────────────────────────┘│ │
│ │                                                              │ │
│ │ [+ Add Action]                                               │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ADVANCED OPTIONS                                      [▼]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│                          [Cancel] [Test Rule] [Save Rule]        │
└─────────────────────────────────────────────────────────────────┘
```

#### Component Token Specifications

```css
/* Business Rule Builder Container */
.ruleBuilder {
    /* Layout */
    display: flex;
    flex-direction: column;
    gap: var(--hw-spacing-6);
    padding: var(--hw-spacing-6);
    max-width: 1200px;
    margin: 0 auto;

    /* Surface */
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-lg);

    /* Shadow */
    box-shadow: var(--hw-shadow-md);
}

/* Rule Name Section */
.ruleHeader {
    display: flex;
    align-items: center;
    gap: var(--hw-spacing-4);
    padding: var(--hw-spacing-4);
    background: var(--hw-surface-secondary);
    border-radius: var(--hw-radius-md);
}

.ruleNameInput {
    flex: 1;
    font-size: var(--hw-font-size-xl);
    font-weight: var(--hw-font-weight-semibold);
    color: var(--hw-text-primary);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    padding: var(--hw-spacing-2);
    transition: border-color 0.2s ease;
}

.ruleNameInput:focus {
    outline: none;
    border-bottom-color: var(--hw-accent-primary);
}

.ruleNameInput::placeholder {
    color: var(--hw-text-tertiary);
}

.activeToggle {
    /* Switch component from design system */
    --toggle-bg-active: var(--hw-accent-primary);
    --toggle-bg-inactive: var(--hw-surface-tertiary);
}

/* Section Container */
.section {
    background: var(--hw-surface-secondary);
    border: 1px solid var(--hw-border-subtle);
    border-radius: var(--hw-radius-md);
    padding: var(--hw-spacing-5);
}

.sectionTitle {
    font-size: var(--hw-font-size-lg);
    font-weight: var(--hw-font-weight-semibold);
    color: var(--hw-text-primary);
    margin-bottom: var(--hw-spacing-4);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Trigger Configuration */
.triggerConfig {
    display: flex;
    gap: var(--hw-spacing-4);
    margin-bottom: var(--hw-spacing-4);
}

.triggerSelect {
    flex: 1;
    padding: var(--hw-spacing-3) var(--hw-spacing-4);
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-sm);
    color: var(--hw-text-primary);
    font-size: var(--hw-font-size-md);
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.triggerSelect:hover {
    border-color: var(--hw-border-hover);
}

.triggerSelect:focus {
    outline: none;
    border-color: var(--hw-accent-primary);
    box-shadow: 0 0 0 3px var(--hw-accent-alpha-10);
}

.collectionLabel {
    display: inline-block;
    padding: var(--hw-spacing-2) var(--hw-spacing-3);
    background: var(--hw-surface-tertiary);
    border-radius: var(--hw-radius-sm);
    font-size: var(--hw-font-size-sm);
    color: var(--hw-text-secondary);
    font-weight: var(--hw-font-weight-medium);
}

/* Condition Builder */
.conditionGroup {
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-md);
    padding: var(--hw-spacing-4);
    margin-bottom: var(--hw-spacing-3);
}

.condition {
    display: flex;
    align-items: center;
    gap: var(--hw-spacing-3);
    padding: var(--hw-spacing-3);
    background: var(--hw-surface-secondary);
    border-radius: var(--hw-radius-sm);
    margin-bottom: var(--hw-spacing-2);
}

.conditionOperatorLabel {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 32px;
    background: var(--hw-accent-alpha-10);
    color: var(--hw-accent-primary);
    border-radius: var(--hw-radius-sm);
    font-size: var(--hw-font-size-sm);
    font-weight: var(--hw-font-weight-semibold);
}

.propertySelect,
.operatorSelect,
.valueInput {
    padding: var(--hw-spacing-2) var(--hw-spacing-3);
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-sm);
    color: var(--hw-text-primary);
    font-size: var(--hw-font-size-md);
    transition: border-color 0.2s ease;
}

.propertySelect {
    flex: 2;
    min-width: 180px;
}

.operatorSelect {
    flex: 1.5;
    min-width: 140px;
}

.valueInput {
    flex: 2;
    min-width: 160px;
}

.propertySelect:focus,
.operatorSelect:focus,
.valueInput:focus {
    outline: none;
    border-color: var(--hw-accent-primary);
    box-shadow: 0 0 0 3px var(--hw-accent-alpha-10);
}

.removeButton {
    padding: var(--hw-spacing-2);
    background: transparent;
    border: none;
    color: var(--hw-text-tertiary);
    cursor: pointer;
    transition: color 0.2s ease;
}

.removeButton:hover {
    color: var(--hw-danger);
}

.removeButton svg {
    width: 20px;
    height: 20px;
}

/* Action Builder */
.actionCard {
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-left: 4px solid var(--hw-accent-primary);
    border-radius: var(--hw-radius-md);
    padding: var(--hw-spacing-4);
    margin-bottom: var(--hw-spacing-3);
    transition: box-shadow 0.2s ease;
}

.actionCard:hover {
    box-shadow: var(--hw-shadow-sm);
}

.actionHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--hw-spacing-3);
}

.actionNumber {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--hw-accent-primary);
    color: var(--hw-text-on-accent);
    border-radius: 50%;
    font-weight: var(--hw-font-weight-semibold);
    font-size: var(--hw-font-size-sm);
}

.actionType {
    flex: 1;
    margin-left: var(--hw-spacing-3);
    font-size: var(--hw-font-size-md);
    font-weight: var(--hw-font-weight-medium);
    color: var(--hw-text-primary);
}

.actionControls {
    display: flex;
    gap: var(--hw-spacing-2);
}

.dragHandle,
.deleteAction {
    padding: var(--hw-spacing-2);
    background: transparent;
    border: none;
    color: var(--hw-text-tertiary);
    cursor: pointer;
    transition: color 0.2s ease;
}

.dragHandle:hover {
    color: var(--hw-accent-primary);
    cursor: move;
}

.deleteAction:hover {
    color: var(--hw-danger);
}

.actionBody {
    display: flex;
    flex-direction: column;
    gap: var(--hw-spacing-3);
}

.actionField {
    display: flex;
    flex-direction: column;
    gap: var(--hw-spacing-2);
}

.actionFieldLabel {
    font-size: var(--hw-font-size-sm);
    font-weight: var(--hw-font-weight-medium);
    color: var(--hw-text-secondary);
}

.actionFieldInput {
    padding: var(--hw-spacing-2) var(--hw-spacing-3);
    background: var(--hw-surface-secondary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-sm);
    color: var(--hw-text-primary);
    font-size: var(--hw-font-size-md);
}

/* Add Buttons */
.addButton {
    display: inline-flex;
    align-items: center;
    gap: var(--hw-spacing-2);
    padding: var(--hw-spacing-2) var(--hw-spacing-4);
    background: transparent;
    border: 1px dashed var(--hw-border-default);
    border-radius: var(--hw-radius-sm);
    color: var(--hw-accent-primary);
    font-size: var(--hw-font-size-sm);
    font-weight: var(--hw-font-weight-medium);
    cursor: pointer;
    transition: all 0.2s ease;
}

.addButton:hover {
    background: var(--hw-accent-alpha-10);
    border-color: var(--hw-accent-primary);
    border-style: solid;
}

.addButton svg {
    width: 16px;
    height: 16px;
}

/* Footer Actions */
.footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--hw-spacing-3);
    padding-top: var(--hw-spacing-4);
    border-top: 1px solid var(--hw-border-subtle);
}

.cancelButton {
    padding: var(--hw-spacing-3) var(--hw-spacing-5);
    background: transparent;
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-md);
    color: var(--hw-text-primary);
    font-size: var(--hw-font-size-md);
    font-weight: var(--hw-font-weight-medium);
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.cancelButton:hover {
    background: var(--hw-surface-secondary);
}

.testButton {
    padding: var(--hw-spacing-3) var(--hw-spacing-5);
    background: var(--hw-surface-secondary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-md);
    color: var(--hw-text-primary);
    font-size: var(--hw-font-size-md);
    font-weight: var(--hw-font-weight-medium);
    cursor: pointer;
    transition: all 0.2s ease;
}

.testButton:hover {
    background: var(--hw-accent-alpha-10);
    border-color: var(--hw-accent-primary);
    color: var(--hw-accent-primary);
}

.saveButton {
    padding: var(--hw-spacing-3) var(--hw-spacing-6);
    background: var(--hw-accent-primary);
    border: none;
    border-radius: var(--hw-radius-md);
    color: var(--hw-text-on-accent);
    font-size: var(--hw-font-size-md);
    font-weight: var(--hw-font-weight-semibold);
    cursor: pointer;
    transition: background-color 0.2s ease, transform 0.1s ease;
}

.saveButton:hover {
    background: var(--hw-accent-hover);
}

.saveButton:active {
    transform: scale(0.98);
}
```

### 2. Schedule Builder

#### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Schedule Configuration                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Schedule Type                                                     │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│ │  ● Daily    │ │  ○ Weekly   │ │  ○ Monthly  │                │
│ └─────────────┘ └─────────────┘ └─────────────┘                │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│ │  ○ Interval │ │  ○ Custom   │ │  ○ Once     │                │
│ └─────────────┘ └─────────────┘ └─────────────┘                │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Time: [09] : [00] [AM ▼]                                    │ │
│ │                                                              │ │
│ │ Timezone: [America/New_York (EST) ▼]                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ Preview                                                           │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ This job will run:                                           │ │
│ │ • Every day at 9:00 AM EST                                   │ │
│ │                                                              │ │
│ │ Next 5 runs:                                                 │ │
│ │ 1. Tomorrow, Dec 31 at 9:00 AM EST                           │ │
│ │ 2. Jan 1, 2026 at 9:00 AM EST                                │ │
│ │ 3. Jan 2, 2026 at 9:00 AM EST                                │ │
│ │ 4. Jan 3, 2026 at 9:00 AM EST                                │ │
│ │ 5. Jan 4, 2026 at 9:00 AM EST                                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Component Tokens

```css
/* Schedule Builder */
.scheduleBuilder {
    background: var(--hw-surface-secondary);
    border: 1px solid var(--hw-border-subtle);
    border-radius: var(--hw-radius-md);
    padding: var(--hw-spacing-5);
}

.scheduleTypeGrid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--hw-spacing-3);
    margin-bottom: var(--hw-spacing-5);
}

.scheduleTypeOption {
    position: relative;
    padding: var(--hw-spacing-4);
    background: var(--hw-surface-primary);
    border: 2px solid var(--hw-border-default);
    border-radius: var(--hw-radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
}

.scheduleTypeOption:hover {
    border-color: var(--hw-accent-primary);
    box-shadow: var(--hw-shadow-sm);
}

.scheduleTypeOption[data-selected="true"] {
    background: var(--hw-accent-alpha-10);
    border-color: var(--hw-accent-primary);
    border-width: 2px;
}

.scheduleTypeOption input[type="radio"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
}

.scheduleTypeLabel {
    display: block;
    font-size: var(--hw-font-size-md);
    font-weight: var(--hw-font-weight-medium);
    color: var(--hw-text-primary);
}

.scheduleTypeOption[data-selected="true"] .scheduleTypeLabel {
    color: var(--hw-accent-primary);
}

/* Time Picker */
.timePicker {
    display: flex;
    align-items: center;
    gap: var(--hw-spacing-2);
    margin-bottom: var(--hw-spacing-4);
}

.timeInput {
    width: 64px;
    padding: var(--hw-spacing-3);
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-sm);
    color: var(--hw-text-primary);
    font-size: var(--hw-font-size-lg);
    font-weight: var(--hw-font-weight-medium);
    text-align: center;
}

.timeSeparator {
    font-size: var(--hw-font-size-xl);
    font-weight: var(--hw-font-weight-bold);
    color: var(--hw-text-secondary);
}

.periodSelect {
    padding: var(--hw-spacing-3);
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-sm);
    color: var(--hw-text-primary);
    font-size: var(--hw-font-size-md);
}

/* Schedule Preview */
.schedulePreview {
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-left: 4px solid var(--hw-accent-primary);
    border-radius: var(--hw-radius-md);
    padding: var(--hw-spacing-4);
}

.schedulePreviewTitle {
    font-size: var(--hw-font-size-md);
    font-weight: var(--hw-font-weight-semibold);
    color: var(--hw-text-primary);
    margin-bottom: var(--hw-spacing-3);
}

.scheduleDescription {
    font-size: var(--hw-font-size-md);
    color: var(--hw-text-secondary);
    margin-bottom: var(--hw-spacing-4);
}

.nextRunsList {
    list-style: none;
    padding: 0;
    margin: 0;
}

.nextRunItem {
    padding: var(--hw-spacing-2) 0;
    font-size: var(--hw-font-size-sm);
    color: var(--hw-text-tertiary);
}

.nextRunItem:first-child {
    font-weight: var(--hw-font-weight-medium);
    color: var(--hw-text-primary);
}
```

### 3. Calculated Property Designer

#### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Calculated Property                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Property: [Total Amount ▼]                                       │
│                                                                   │
│ Calculation Type                                                  │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│ │  ● Formula  │ │  ○ Rollup   │ │  ○ Duration │                │
│ └─────────────┘ └─────────────┘ └─────────────┘                │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Formula Editor                                               │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ 1  [Quantity] * [Unit Price] * (1 - [Discount] / 100) │ │ │
│ │ │ 2  _                                                      │ │ │
│ │ │                                                           │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                              │ │
│ │ Available Properties:          Available Functions:         │ │
│ │ • Quantity                     • SUM()                       │ │
│ │ • Unit Price                   • AVG()                       │ │
│ │ • Discount                     • COUNT()                     │ │
│ │ • Tax Rate                     • MAX()                       │ │
│ │                                • MIN()                       │ │
│ │                                • ROUND()                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ☐ Store calculated value in database                            │
│ ☑ Recalculate when dependencies change                          │
│                                                                   │
│ Preview                                                           │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Sample calculation:                                          │ │
│ │ Quantity: 10                                                 │ │
│ │ Unit Price: $50.00                                           │ │
│ │ Discount: 15%                                                │ │
│ │                                                              │ │
│ │ Result: $425.00                                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Component Tokens

```css
/* Formula Editor */
.formulaEditor {
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-md);
    padding: var(--hw-spacing-4);
    margin-bottom: var(--hw-spacing-4);
}

.formulaEditorTitle {
    font-size: var(--hw-font-size-sm);
    font-weight: var(--hw-font-weight-medium);
    color: var(--hw-text-secondary);
    margin-bottom: var(--hw-spacing-3);
}

.formulaCodeEditor {
    /* Monaco Editor customization */
    --monaco-bg: var(--hw-surface-secondary);
    --monaco-fg: var(--hw-text-primary);
    --monaco-border: var(--hw-border-default);
    --monaco-selection: var(--hw-accent-alpha-20);
    --monaco-keyword: var(--hw-accent-primary);
    --monaco-string: var(--hw-success);
    --monaco-number: var(--hw-warning);
    --monaco-operator: var(--hw-text-primary);
    --monaco-property: var(--hw-accent-secondary);

    min-height: 120px;
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-sm);
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
    font-size: var(--hw-font-size-md);
}

.formulaHelpers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--hw-spacing-4);
    margin-top: var(--hw-spacing-4);
}

.helperSection {
    background: var(--hw-surface-secondary);
    border-radius: var(--hw-radius-sm);
    padding: var(--hw-spacing-3);
}

.helperTitle {
    font-size: var(--hw-font-size-sm);
    font-weight: var(--hw-font-weight-semibold);
    color: var(--hw-text-secondary);
    margin-bottom: var(--hw-spacing-2);
}

.helperList {
    list-style: none;
    padding: 0;
    margin: 0;
}

.helperItem {
    padding: var(--hw-spacing-1) 0;
    font-size: var(--hw-font-size-sm);
    font-family: 'Fira Code', monospace;
    color: var(--hw-text-tertiary);
    cursor: pointer;
    transition: color 0.2s ease;
}

.helperItem:hover {
    color: var(--hw-accent-primary);
}

/* Calculation Options */
.calculationOptions {
    display: flex;
    flex-direction: column;
    gap: var(--hw-spacing-3);
    margin: var(--hw-spacing-4) 0;
}

.optionCheckbox {
    display: flex;
    align-items: center;
    gap: var(--hw-spacing-2);
}

.optionCheckbox input[type="checkbox"] {
    width: 20px;
    height: 20px;
    accent-color: var(--hw-accent-primary);
    cursor: pointer;
}

.optionLabel {
    font-size: var(--hw-font-size-md);
    color: var(--hw-text-primary);
    cursor: pointer;
}

/* Preview Section */
.calculationPreview {
    background: var(--hw-surface-tertiary);
    border: 1px solid var(--hw-border-subtle);
    border-radius: var(--hw-radius-md);
    padding: var(--hw-spacing-4);
}

.previewTitle {
    font-size: var(--hw-font-size-md);
    font-weight: var(--hw-font-weight-semibold);
    color: var(--hw-text-primary);
    margin-bottom: var(--hw-spacing-3);
}

.previewInputs {
    display: flex;
    flex-direction: column;
    gap: var(--hw-spacing-2);
    margin-bottom: var(--hw-spacing-4);
}

.previewInput {
    display: flex;
    justify-content: space-between;
    font-size: var(--hw-font-size-sm);
    color: var(--hw-text-secondary);
}

.previewInput strong {
    color: var(--hw-text-primary);
}

.previewResult {
    padding: var(--hw-spacing-3);
    background: var(--hw-surface-primary);
    border-left: 4px solid var(--hw-accent-primary);
    border-radius: var(--hw-radius-sm);
}

.resultLabel {
    font-size: var(--hw-font-size-sm);
    color: var(--hw-text-tertiary);
    margin-bottom: var(--hw-spacing-1);
}

.resultValue {
    font-size: var(--hw-font-size-xl);
    font-weight: var(--hw-font-weight-bold);
    color: var(--hw-accent-primary);
}
```

### 4. Validation Rule Designer

#### Component Tokens

```css
/* Validation Rule Designer */
.validationBuilder {
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-lg);
    padding: var(--hw-spacing-6);
}

.validationType {
    display: flex;
    gap: var(--hw-spacing-3);
    margin-bottom: var(--hw-spacing-5);
}

.validationTypeButton {
    flex: 1;
    padding: var(--hw-spacing-4);
    background: var(--hw-surface-secondary);
    border: 2px solid var(--hw-border-default);
    border-radius: var(--hw-radius-md);
    color: var(--hw-text-primary);
    font-size: var(--hw-font-size-md);
    font-weight: var(--hw-font-weight-medium);
    cursor: pointer;
    transition: all 0.2s ease;
}

.validationTypeButton:hover {
    border-color: var(--hw-accent-primary);
    box-shadow: var(--hw-shadow-sm);
}

.validationTypeButton[data-selected="true"] {
    background: var(--hw-accent-alpha-10);
    border-color: var(--hw-accent-primary);
    color: var(--hw-accent-primary);
}

.errorMessageInput {
    width: 100%;
    padding: var(--hw-spacing-3);
    background: var(--hw-surface-secondary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-sm);
    color: var(--hw-text-primary);
    font-size: var(--hw-font-size-md);
    resize: vertical;
    min-height: 80px;
}

.errorMessageInput::placeholder {
    color: var(--hw-text-tertiary);
}

.errorMessagePreview {
    margin-top: var(--hw-spacing-3);
    padding: var(--hw-spacing-3);
    background: var(--hw-danger-alpha-10);
    border-left: 4px solid var(--hw-danger);
    border-radius: var(--hw-radius-sm);
}

.errorMessagePreview::before {
    content: '⚠ ';
    color: var(--hw-danger);
    font-weight: var(--hw-font-weight-bold);
}

.errorMessageText {
    color: var(--hw-danger);
    font-size: var(--hw-font-size-sm);
}
```

### 5. Client Script Designer

#### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Client Script Designer                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Script Type: [onChange ▼]                                        │
│ Property:    [Priority ▼]                                        │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ WHEN Priority changes                                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ IF Priority equals "Critical"                                │ │
│ │                                                              │ │
│ │ THEN:                                                        │ │
│ │ ┌──────────────────────────────────────────────────────────┐│ │
│ │ │ ☑ Make property required: Business Impact               ││ │
│ │ │ ☑ Make property required: Affected Users                ││ │
│ │ │ ☑ Show property: Escalation Manager                     ││ │
│ │ │ ☐ Show warning message                                   ││ │
│ │ └──────────────────────────────────────────────────────────┘│ │
│ │                                                              │ │
│ │ ELSE:                                                        │ │
│ │ ┌──────────────────────────────────────────────────────────┐│ │
│ │ │ ☑ Make property optional: Business Impact               ││ │
│ │ │ ☑ Make property optional: Affected Users                ││ │
│ │ │ ☑ Hide property: Escalation Manager                     ││ │
│ │ └──────────────────────────────────────────────────────────┘│ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ [+ Add Action]                                                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Component Tokens

```css
/* Client Script Designer */
.clientScriptDesigner {
    background: var(--hw-surface-primary);
    border: 1px solid var(--hw-border-default);
    border-radius: var(--hw-radius-lg);
    padding: var(--hw-spacing-6);
}

.scriptConfiguration {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--hw-spacing-4);
    margin-bottom: var(--hw-spacing-5);
}

.whenStatement {
    background: var(--hw-accent-alpha-10);
    border-left: 4px solid var(--hw-accent-primary);
    border-radius: var(--hw-radius-sm);
    padding: var(--hw-spacing-3);
    font-size: var(--hw-font-size-md);
    font-weight: var(--hw-font-weight-medium);
    color: var(--hw-text-primary);
    margin-bottom: var(--hw-spacing-4);
}

.conditionalActions {
    background: var(--hw-surface-secondary);
    border: 1px solid var(--hw-border-subtle);
    border-radius: var(--hw-radius-md);
    padding: var(--hw-spacing-4);
}

.conditionalLabel {
    display: inline-block;
    padding: var(--hw-spacing-2) var(--hw-spacing-3);
    background: var(--hw-accent-primary);
    color: var(--hw-text-on-accent);
    border-radius: var(--hw-radius-sm);
    font-size: var(--hw-font-size-sm);
    font-weight: var(--hw-font-weight-semibold);
    margin-bottom: var(--hw-spacing-3);
}

.actionsList {
    display: flex;
    flex-direction: column;
    gap: var(--hw-spacing-2);
}

.actionCheckbox {
    display: flex;
    align-items: center;
    gap: var(--hw-spacing-3);
    padding: var(--hw-spacing-2);
    background: var(--hw-surface-primary);
    border-radius: var(--hw-radius-sm);
}

.actionCheckbox input[type="checkbox"] {
    width: 20px;
    height: 20px;
    accent-color: var(--hw-accent-primary);
}

.actionCheckboxLabel {
    flex: 1;
    font-size: var(--hw-font-size-sm);
    color: var(--hw-text-primary);
}
```

---

## Design Tokens

### Color Tokens (Using CSS Custom Properties)

```css
/* Never hardcode colors - always use tokens */

/* Surface Colors */
--hw-surface-primary: #ffffff;      /* Main background */
--hw-surface-secondary: #f8f9fa;    /* Secondary background */
--hw-surface-tertiary: #e9ecef;     /* Tertiary background */

/* Text Colors */
--hw-text-primary: #212529;         /* Primary text */
--hw-text-secondary: #6c757d;       /* Secondary text */
--hw-text-tertiary: #adb5bd;        /* Tertiary text */
--hw-text-on-accent: #ffffff;       /* Text on accent colors */

/* Border Colors */
--hw-border-default: #dee2e6;       /* Default borders */
--hw-border-subtle: #f1f3f5;        /* Subtle borders */
--hw-border-hover: #adb5bd;         /* Border on hover */

/* Accent Colors */
--hw-accent-primary: #0066cc;       /* Primary accent */
--hw-accent-hover: #0052a3;         /* Accent hover state */
--hw-accent-secondary: #6610f2;     /* Secondary accent */
--hw-accent-alpha-10: rgba(0, 102, 204, 0.1);
--hw-accent-alpha-20: rgba(0, 102, 204, 0.2);

/* Semantic Colors */
--hw-success: #28a745;
--hw-warning: #ffc107;
--hw-danger: #dc3545;
--hw-info: #17a2b8;
--hw-danger-alpha-10: rgba(220, 53, 69, 0.1);

/* Spacing Scale */
--hw-spacing-1: 4px;
--hw-spacing-2: 8px;
--hw-spacing-3: 12px;
--hw-spacing-4: 16px;
--hw-spacing-5: 20px;
--hw-spacing-6: 24px;
--hw-spacing-8: 32px;

/* Typography */
--hw-font-size-xs: 12px;
--hw-font-size-sm: 14px;
--hw-font-size-md: 16px;
--hw-font-size-lg: 18px;
--hw-font-size-xl: 24px;

--hw-font-weight-normal: 400;
--hw-font-weight-medium: 500;
--hw-font-weight-semibold: 600;
--hw-font-weight-bold: 700;

/* Border Radius */
--hw-radius-sm: 4px;
--hw-radius-md: 8px;
--hw-radius-lg: 12px;

/* Shadows */
--hw-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
--hw-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
--hw-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
```

---

## User Flows

### 1. Creating a Business Rule

```
1. User clicks "Create Rule" button
   ↓
2. Rule Builder modal opens
   ↓
3. User enters rule name
   ↓
4. User selects trigger (When record is created/updated/deleted)
   ↓
5. User selects timing (Before/After operation)
   ↓
6. User adds conditions (optional)
   - Clicks "+ Add Condition"
   - Selects property from dropdown
   - Selects operator
   - Enters value
   - Can add multiple conditions with AND/OR
   ↓
7. User adds actions
   - Clicks "+ Add Action"
   - Selects action type (Set Property, Send Notification, etc.)
   - Configures action parameters
   - Can add multiple actions (executed in order)
   ↓
8. User tests rule (optional)
   - Clicks "Test Rule"
   - Enters sample record data
   - Views execution results
   ↓
9. User saves rule
   - Clicks "Save Rule"
   - Rule is activated automatically (unless disabled)
```

### 2. Creating a Scheduled Job

```
1. User clicks "Create Scheduled Job" button
   ↓
2. Schedule Builder modal opens
   ↓
3. User enters job name and description
   ↓
4. User selects collection to operate on
   ↓
5. User sets schedule
   - Selects schedule type (Daily, Weekly, Monthly, Interval, Custom, Once)
   - Configures schedule parameters
   - Selects timezone
   - Views preview of next 5 runs
   ↓
6. User sets query conditions (which records to process)
   ↓
7. User adds actions to perform on each record
   ↓
8. User saves scheduled job
   ↓
9. Job is queued and will run at next scheduled time
```

---

## Accessibility Requirements

### WCAG 2.1 Level AA Compliance

#### 1. Keyboard Navigation
- All interactive elements must be keyboard accessible
- Tab order follows logical reading order
- Focus indicators visible on all interactive elements
- Escape key closes modals and dropdowns

#### 2. Screen Reader Support
- All form inputs have associated labels
- ARIA labels for icon-only buttons
- ARIA live regions for dynamic content updates
- ARIA roles for custom components

#### 3. Color Contrast
- Text must have minimum 4.5:1 contrast ratio
- Large text (18pt+) must have 3:1 contrast ratio
- Interactive elements must have 3:1 contrast ratio

#### 4. Focus Management
```css
/* Focus styles */
*:focus-visible {
    outline: 2px solid var(--hw-accent-primary);
    outline-offset: 2px;
    border-radius: var(--hw-radius-sm);
}

/* Skip focus for mouse users */
*:focus:not(:focus-visible) {
    outline: none;
}
```

---

## Responsive Design

### Breakpoints

```css
/* Mobile First Approach */
--hw-breakpoint-sm: 640px;   /* Small devices */
--hw-breakpoint-md: 768px;   /* Medium devices */
--hw-breakpoint-lg: 1024px;  /* Large devices */
--hw-breakpoint-xl: 1280px;  /* Extra large devices */
```

### Mobile Adaptations

```css
/* Rule Builder on Mobile */
@media (max-width: 768px) {
    .ruleBuilder {
        padding: var(--hw-spacing-4);
    }

    .triggerConfig {
        flex-direction: column;
    }

    .condition {
        flex-direction: column;
        align-items: stretch;
    }

    .scheduleTypeGrid {
        grid-template-columns: 1fr;
    }

    .footer {
        flex-direction: column;
    }

    .footer button {
        width: 100%;
    }
}
```

---

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**Design System Version:** HubbleWave DS 2.0
