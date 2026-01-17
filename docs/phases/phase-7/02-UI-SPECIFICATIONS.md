# Phase 7: Revolutionary Features - UI Specifications

**Target Audience:** UI/UX Designers, Frontend Developers
**Prerequisites:** HubbleWave Design System, CSS Custom Properties
**Styling Standard:** CSS Custom Properties only (--hw-* namespace)

## Table of Contents

1. [Design Principles](#design-principles)
2. [CSS Custom Properties](#css-custom-properties)
3. [Voice Control UI](#voice-control-ui)
4. [AR Overlay Components](#ar-overlay-components)
5. [Predictive UI Hints](#predictive-ui-hints)
6. [App Builder Canvas](#app-builder-canvas)
7. [Report Generator](#report-generator)
8. [Digital Twin Viewer](#digital-twin-viewer)
9. [Accessibility](#accessibility)
10. [Responsive Design](#responsive-design)

---

## Design Principles

### Revolutionary Features UI Guidelines

1. **Non-Intrusive Innovation:** Revolutionary features should enhance, not disrupt the existing workflow
2. **Progressive Disclosure:** Advanced features are available but not overwhelming
3. **Immediate Feedback:** All AI/ML actions provide clear, immediate visual feedback
4. **Graceful Degradation:** Features degrade gracefully when technology is unsupported
5. **Zero Learning Curve:** Intuitive interfaces that require minimal explanation
6. **Performance First:** Smooth 60fps animations, instant response to user actions

### Visual Hierarchy for Revolutionary Features

- **Primary:** User-initiated actions (voice button, AR trigger, predictive suggestions)
- **Secondary:** System responses (loading states, processing indicators)
- **Tertiary:** Background processes (health monitoring, sync status)

---

## CSS Custom Properties

### Revolutionary Features Theme

```css
:root {
  /* Voice Control Colors */
  --hw-voice-primary: #00d4ff;
  --hw-voice-active: #00ff88;
  --hw-voice-error: #ff3366;
  --hw-voice-listening: rgba(0, 212, 255, 0.2);
  --hw-voice-pulse: rgba(0, 255, 136, 0.4);

  /* AR/VR Colors */
  --hw-ar-overlay: rgba(26, 26, 26, 0.85);
  --hw-ar-accent: #00ffcc;
  --hw-ar-highlight: rgba(0, 255, 204, 0.3);
  --hw-ar-marker: #ff00ff;
  --hw-ar-grid: rgba(255, 255, 255, 0.1);

  /* Digital Twin Colors */
  --hw-twin-operational: #00ff88;
  --hw-twin-warning: #ffaa00;
  --hw-twin-critical: #ff3366;
  --hw-twin-offline: #808080;
  --hw-twin-sync: #00d4ff;

  /* Predictive UI Colors */
  --hw-prediction-bg: rgba(100, 100, 255, 0.1);
  --hw-prediction-border: rgba(100, 100, 255, 0.3);
  --hw-prediction-text: #6666ff;
  --hw-prediction-hover: rgba(100, 100, 255, 0.2);

  /* App Builder Colors */
  --hw-builder-canvas: #1a1a1a;
  --hw-builder-grid: rgba(255, 255, 255, 0.05);
  --hw-builder-component: #2a2a2a;
  --hw-builder-selected: #00d4ff;
  --hw-builder-drop-zone: rgba(0, 212, 255, 0.2);

  /* Self-Healing Colors */
  --hw-health-healthy: #00ff88;
  --hw-health-degraded: #ffaa00;
  --hw-health-critical: #ff3366;
  --hw-health-recovering: #00d4ff;

  /* Spacing for Revolutionary Features */
  --hw-voice-button-size: 64px;
  --hw-ar-overlay-padding: var(--hw-spacing-lg);
  --hw-prediction-gap: var(--hw-spacing-sm);
  --hw-builder-grid-size: 20px;

  /* Animations */
  --hw-voice-pulse-duration: 2s;
  --hw-ar-fade-duration: 0.3s;
  --hw-prediction-slide-duration: 0.4s;
  --hw-twin-sync-duration: 1s;

  /* Z-index Layers */
  --hw-z-voice-control: 1000;
  --hw-z-ar-overlay: 1100;
  --hw-z-predictive-hints: 900;
  --hw-z-builder-toolbar: 800;

  /* Glassmorphism Effects */
  --hw-glass-bg: rgba(26, 26, 26, 0.7);
  --hw-glass-border: rgba(255, 255, 255, 0.1);
  --hw-glass-blur: 10px;
}

/* Dark Mode Adjustments */
[data-theme="dark"] {
  --hw-ar-overlay: rgba(10, 10, 10, 0.9);
  --hw-builder-canvas: #0a0a0a;
  --hw-builder-component: #1a1a1a;
}

/* Light Mode Adjustments */
[data-theme="light"] {
  --hw-ar-overlay: rgba(255, 255, 255, 0.85);
  --hw-builder-canvas: #f5f5f5;
  --hw-builder-component: #ffffff;
  --hw-prediction-bg: rgba(100, 100, 255, 0.05);
}
```

---

## Voice Control UI

### Voice Control Button

```css
.hw-voice-button {
  width: var(--hw-voice-button-size);
  height: var(--hw-voice-button-size);
  border-radius: 50%;
  background: linear-gradient(135deg, var(--hw-voice-primary), var(--hw-voice-active));
  border: none;
  cursor: pointer;
  position: fixed;
  bottom: var(--hw-spacing-xl);
  right: var(--hw-spacing-xl);
  z-index: var(--hw-z-voice-control);
  box-shadow: 0 4px 20px rgba(0, 212, 255, 0.4);
  transition: all 0.3s var(--hw-transition-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hw-voice-button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 30px rgba(0, 212, 255, 0.6);
}

.hw-voice-button:active {
  transform: scale(0.95);
}

.hw-voice-button.hw-voice-active {
  background: linear-gradient(135deg, var(--hw-voice-active), var(--hw-voice-primary));
  animation: voicePulse var(--hw-voice-pulse-duration) infinite;
}

.hw-voice-button.hw-voice-error {
  background: var(--hw-voice-error);
  animation: shake 0.5s;
}

/* Voice pulse animation */
@keyframes voicePulse {
  0%, 100% {
    box-shadow: 0 0 0 0 var(--hw-voice-pulse);
  }
  50% {
    box-shadow: 0 0 0 20px rgba(0, 255, 136, 0);
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.hw-voice-icon {
  width: 32px;
  height: 32px;
  fill: white;
}

.hw-voice-pulse {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--hw-voice-listening);
  animation: voicePulse var(--hw-voice-pulse-duration) infinite;
}
```

### Voice Status Panel

```css
.hw-voice-panel {
  position: fixed;
  bottom: calc(var(--hw-spacing-xl) + var(--hw-voice-button-size) + var(--hw-spacing-md));
  right: var(--hw-spacing-xl);
  z-index: var(--hw-z-voice-control);
  background: var(--hw-glass-bg);
  backdrop-filter: blur(var(--hw-glass-blur));
  border: 1px solid var(--hw-glass-border);
  border-radius: var(--hw-radius-lg);
  padding: var(--hw-spacing-md);
  min-width: 300px;
  box-shadow: var(--hw-shadow-lg);
}

.hw-voice-status {
  color: var(--hw-voice-primary);
  font-size: var(--hw-font-size-sm);
  margin-bottom: var(--hw-spacing-sm);
  display: flex;
  align-items: center;
  gap: var(--hw-spacing-sm);
}

.hw-voice-status::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--hw-voice-active);
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.hw-voice-transcript {
  background: rgba(0, 212, 255, 0.1);
  border-left: 3px solid var(--hw-voice-primary);
  padding: var(--hw-spacing-sm);
  border-radius: var(--hw-radius-sm);
  font-size: var(--hw-font-size-sm);
  color: var(--hw-text-primary);
  margin-top: var(--hw-spacing-sm);
  animation: slideIn var(--hw-prediction-slide-duration) var(--hw-transition-smooth);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hw-voice-help {
  margin-top: var(--hw-spacing-md);
  padding-top: var(--hw-spacing-md);
  border-top: 1px solid var(--hw-glass-border);
}

.hw-voice-help h4 {
  font-size: var(--hw-font-size-sm);
  color: var(--hw-text-secondary);
  margin: 0 0 var(--hw-spacing-sm) 0;
  font-weight: 600;
}

.hw-voice-help ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.hw-voice-help li {
  font-size: var(--hw-font-size-xs);
  color: var(--hw-text-tertiary);
  padding: var(--hw-spacing-xs) 0;
  font-family: var(--hw-font-mono);
}

.hw-voice-not-supported {
  background: rgba(255, 51, 102, 0.1);
  border: 1px solid rgba(255, 51, 102, 0.3);
  border-radius: var(--hw-radius-md);
  padding: var(--hw-spacing-md);
  color: var(--hw-voice-error);
  text-align: center;
}
```

---

## AR Overlay Components

### AR Asset Overlay

```css
.hw-ar-asset-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: var(--hw-z-ar-overlay);
}

.hw-ar-not-supported {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--hw-glass-bg);
  backdrop-filter: blur(var(--hw-glass-blur));
  border: 1px solid var(--hw-glass-border);
  border-radius: var(--hw-radius-lg);
  padding: var(--hw-spacing-xl);
  text-align: center;
  max-width: 400px;
}

.hw-ar-not-supported p {
  margin: var(--hw-spacing-sm) 0;
  color: var(--hw-text-secondary);
}

.hw-ar-controls {
  position: fixed;
  top: var(--hw-spacing-md);
  left: 50%;
  transform: translateX(-50%);
  z-index: calc(var(--hw-z-ar-overlay) + 1);
  display: flex;
  gap: var(--hw-spacing-sm);
}

.hw-ar-canvas {
  width: 100%;
  height: 100%;
}
```

### AR Info Panel

```css
.hw-ar-info-panel {
  background: var(--hw-ar-overlay);
  backdrop-filter: blur(var(--hw-glass-blur));
  border: 1px solid var(--hw-ar-accent);
  border-radius: var(--hw-radius-md);
  padding: var(--hw-ar-overlay-padding);
  color: white;
  min-width: 300px;
  box-shadow: 0 8px 32px rgba(0, 255, 204, 0.2);
}

.hw-ar-info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--hw-spacing-md);
  padding-bottom: var(--hw-spacing-sm);
  border-bottom: 1px solid var(--hw-ar-accent);
}

.hw-ar-info-title {
  font-size: var(--hw-font-size-lg);
  font-weight: 700;
  color: var(--hw-ar-accent);
  margin: 0;
}

.hw-ar-status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--hw-twin-operational);
  box-shadow: 0 0 10px currentColor;
}

.hw-ar-status-indicator[data-status="warning"] {
  background: var(--hw-twin-warning);
}

.hw-ar-status-indicator[data-status="critical"] {
  background: var(--hw-twin-critical);
}

.hw-ar-status-indicator[data-status="offline"] {
  background: var(--hw-twin-offline);
}

.hw-ar-info-row {
  display: flex;
  justify-content: space-between;
  padding: var(--hw-spacing-sm) 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.hw-ar-info-row:last-child {
  border-bottom: none;
}

.hw-ar-info-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: var(--hw-font-size-sm);
}

.hw-ar-info-value {
  color: white;
  font-size: var(--hw-font-size-sm);
  font-weight: 600;
}
```

### AR Marker

```css
.hw-ar-marker {
  position: absolute;
  width: 40px;
  height: 40px;
  border: 2px solid var(--hw-ar-marker);
  border-radius: 50%;
  background: rgba(255, 0, 255, 0.2);
  box-shadow: 0 0 20px var(--hw-ar-marker);
  animation: markerPulse 2s infinite;
  cursor: pointer;
  transition: all 0.3s;
}

.hw-ar-marker:hover {
  transform: scale(1.2);
  background: rgba(255, 0, 255, 0.4);
}

.hw-ar-marker::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--hw-ar-marker);
}

@keyframes markerPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}
```

---

## Predictive UI Hints

### Predictive Suggestions Container

```css
.hw-predictive-suggestions {
  position: fixed;
  bottom: var(--hw-spacing-lg);
  left: var(--hw-spacing-lg);
  z-index: var(--hw-z-predictive-hints);
  max-width: 400px;
  animation: slideInFromLeft var(--hw-prediction-slide-duration) var(--hw-transition-smooth);
}

@keyframes slideInFromLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.hw-suggestions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--hw-prediction-bg);
  border: 1px solid var(--hw-prediction-border);
  border-radius: var(--hw-radius-md) var(--hw-radius-md) 0 0;
  padding: var(--hw-spacing-sm) var(--hw-spacing-md);
}

.hw-suggestions-header h4 {
  margin: 0;
  font-size: var(--hw-font-size-sm);
  font-weight: 600;
  color: var(--hw-prediction-text);
}

.hw-suggestions-list {
  background: var(--hw-glass-bg);
  backdrop-filter: blur(var(--hw-glass-blur));
  border: 1px solid var(--hw-glass-border);
  border-top: none;
  border-radius: 0 0 var(--hw-radius-md) var(--hw-radius-md);
  overflow: hidden;
}

.hw-suggestion-item {
  display: flex;
  align-items: center;
  gap: var(--hw-spacing-md);
  padding: var(--hw-spacing-md);
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.hw-suggestion-item:last-child {
  border-bottom: none;
}

.hw-suggestion-item:hover {
  background: var(--hw-prediction-hover);
}

.hw-suggestion-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  color: var(--hw-prediction-text);
}

.hw-suggestion-content {
  flex: 1;
}

.hw-suggestion-label {
  font-size: var(--hw-font-size-sm);
  font-weight: 600;
  color: var(--hw-text-primary);
  margin-bottom: 2px;
}

.hw-suggestion-description {
  font-size: var(--hw-font-size-xs);
  color: var(--hw-text-secondary);
}

.hw-suggestion-confidence {
  font-size: var(--hw-font-size-xs);
  color: var(--hw-prediction-text);
  font-weight: 700;
  padding: 2px 8px;
  background: var(--hw-prediction-bg);
  border-radius: var(--hw-radius-sm);
}
```

### Inline Predictive Hints

```css
.hw-predictive-hint {
  position: relative;
  display: inline-block;
}

.hw-predictive-hint::after {
  content: attr(data-suggestion);
  position: absolute;
  bottom: 100%;
  left: 0;
  background: var(--hw-prediction-bg);
  border: 1px solid var(--hw-prediction-border);
  border-radius: var(--hw-radius-sm);
  padding: var(--hw-spacing-xs) var(--hw-spacing-sm);
  font-size: var(--hw-font-size-xs);
  color: var(--hw-prediction-text);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  margin-bottom: var(--hw-spacing-xs);
}

.hw-predictive-hint:hover::after {
  opacity: 1;
}

.hw-predictive-autocomplete {
  color: var(--hw-text-tertiary);
  font-style: italic;
  pointer-events: none;
}
```

---

## App Builder Canvas

### Builder Container

```css
.hw-builder-container {
  display: grid;
  grid-template-columns: 250px 1fr 300px;
  grid-template-rows: 1fr auto;
  height: 100vh;
  background: var(--hw-builder-canvas);
  gap: 0;
}

.hw-builder-sidebar {
  grid-column: 1;
  grid-row: 1;
  background: var(--hw-surface-elevated);
  border-right: 1px solid var(--hw-border-subtle);
  padding: var(--hw-spacing-md);
  overflow-y: auto;
}

.hw-builder-canvas {
  grid-column: 2;
  grid-row: 1;
  position: relative;
  background-image:
    linear-gradient(var(--hw-builder-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--hw-builder-grid) 1px, transparent 1px);
  background-size: var(--hw-builder-grid-size) var(--hw-builder-grid-size);
  overflow: auto;
}

.hw-builder-canvas.hw-canvas-drag-over {
  background-color: var(--hw-builder-drop-zone);
}

.hw-builder-properties {
  grid-column: 3;
  grid-row: 1;
  background: var(--hw-surface-elevated);
  border-left: 1px solid var(--hw-border-subtle);
  padding: var(--hw-spacing-md);
  overflow-y: auto;
}

.hw-builder-toolbar {
  grid-column: 1 / -1;
  grid-row: 2;
  background: var(--hw-surface-elevated);
  border-top: 1px solid var(--hw-border-subtle);
  padding: var(--hw-spacing-md);
  display: flex;
  gap: var(--hw-spacing-sm);
  justify-content: flex-end;
}
```

### Component Palette

```css
.hw-component-palette {
  display: flex;
  flex-direction: column;
  gap: var(--hw-spacing-sm);
}

.hw-palette-item {
  display: flex;
  align-items: center;
  gap: var(--hw-spacing-sm);
  padding: var(--hw-spacing-sm);
  background: var(--hw-builder-component);
  border: 1px solid var(--hw-border-subtle);
  border-radius: var(--hw-radius-md);
  cursor: grab;
  transition: all 0.2s;
}

.hw-palette-item:hover {
  background: var(--hw-surface-hover);
  border-color: var(--hw-builder-selected);
  transform: translateX(4px);
}

.hw-palette-item.hw-dragging {
  opacity: 0.5;
  cursor: grabbing;
}

.hw-palette-icon {
  width: 20px;
  height: 20px;
  color: var(--hw-text-secondary);
}
```

### Canvas Components

```css
.hw-canvas-component {
  position: absolute;
  background: var(--hw-builder-component);
  border: 2px solid var(--hw-border-subtle);
  border-radius: var(--hw-radius-md);
  padding: var(--hw-spacing-sm);
  min-width: 150px;
  cursor: move;
  transition: all 0.2s;
}

.hw-canvas-component:hover {
  border-color: var(--hw-builder-selected);
  box-shadow: 0 4px 12px rgba(0, 212, 255, 0.2);
}

.hw-canvas-component.hw-selected {
  border-color: var(--hw-builder-selected);
  box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.2);
  z-index: 10;
}

.hw-component-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--hw-spacing-xs);
  margin-bottom: var(--hw-spacing-xs);
  border-bottom: 1px solid var(--hw-border-subtle);
  font-size: var(--hw-font-size-xs);
  font-weight: 600;
  color: var(--hw-text-secondary);
}

.hw-component-preview {
  pointer-events: none;
}

.hw-component-preview input,
.hw-component-preview button {
  width: 100%;
  margin: var(--hw-spacing-xs) 0;
}

.hw-table-preview {
  background: var(--hw-surface-sunken);
  border: 1px solid var(--hw-border-subtle);
  border-radius: var(--hw-radius-sm);
  padding: var(--hw-spacing-sm);
  font-size: var(--hw-font-size-xs);
  color: var(--hw-text-tertiary);
  text-align: center;
}
```

### Properties Panel

```css
.hw-properties-panel {
  display: flex;
  flex-direction: column;
  gap: var(--hw-spacing-md);
}

.hw-property-field {
  display: flex;
  flex-direction: column;
  gap: var(--hw-spacing-xs);
}

.hw-property-field label {
  font-size: var(--hw-font-size-sm);
  font-weight: 600;
  color: var(--hw-text-secondary);
  text-transform: capitalize;
}

.hw-property-field input,
.hw-property-field select,
.hw-property-field textarea {
  width: 100%;
  padding: var(--hw-spacing-sm);
  background: var(--hw-surface-sunken);
  border: 1px solid var(--hw-border-subtle);
  border-radius: var(--hw-radius-sm);
  color: var(--hw-text-primary);
  font-size: var(--hw-font-size-sm);
}

.hw-property-field input:focus,
.hw-property-field select:focus,
.hw-property-field textarea:focus {
  outline: none;
  border-color: var(--hw-builder-selected);
  box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
}
```

---

## Report Generator

### Report Builder Interface

```css
.hw-report-generator {
  display: flex;
  flex-direction: column;
  gap: var(--hw-spacing-lg);
  padding: var(--hw-spacing-lg);
  max-width: 1200px;
  margin: 0 auto;
}

.hw-report-prompt {
  display: flex;
  gap: var(--hw-spacing-sm);
}

.hw-report-input {
  flex: 1;
  padding: var(--hw-spacing-md);
  background: var(--hw-surface-elevated);
  border: 1px solid var(--hw-border-subtle);
  border-radius: var(--hw-radius-lg);
  color: var(--hw-text-primary);
  font-size: var(--hw-font-size-md);
  resize: none;
  min-height: 80px;
}

.hw-report-input:focus {
  outline: none;
  border-color: var(--hw-primary);
  box-shadow: 0 0 0 3px rgba(var(--hw-primary-rgb), 0.1);
}

.hw-report-input::placeholder {
  color: var(--hw-text-tertiary);
  font-style: italic;
}

.hw-report-generating {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--hw-spacing-md);
  padding: var(--hw-spacing-xl);
  background: var(--hw-glass-bg);
  backdrop-filter: blur(var(--hw-glass-blur));
  border: 1px solid var(--hw-glass-border);
  border-radius: var(--hw-radius-lg);
}

.hw-report-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--hw-border-subtle);
  border-top-color: var(--hw-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.hw-report-status {
  font-size: var(--hw-font-size-sm);
  color: var(--hw-text-secondary);
  text-align: center;
}
```

### Report Preview

```css
.hw-report-preview {
  background: var(--hw-surface-elevated);
  border: 1px solid var(--hw-border-subtle);
  border-radius: var(--hw-radius-lg);
  padding: var(--hw-spacing-xl);
}

.hw-report-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--hw-spacing-md);
  margin-bottom: var(--hw-spacing-lg);
  border-bottom: 2px solid var(--hw-border-subtle);
}

.hw-report-title {
  font-size: var(--hw-font-size-2xl);
  font-weight: 700;
  color: var(--hw-text-primary);
  margin: 0;
}

.hw-report-meta {
  font-size: var(--hw-font-size-sm);
  color: var(--hw-text-secondary);
}

.hw-report-section {
  margin-bottom: var(--hw-spacing-xl);
}

.hw-report-section-title {
  font-size: var(--hw-font-size-lg);
  font-weight: 600;
  color: var(--hw-text-primary);
  margin: 0 0 var(--hw-spacing-md) 0;
}

.hw-report-summary {
  background: rgba(100, 100, 255, 0.05);
  border-left: 4px solid var(--hw-prediction-text);
  padding: var(--hw-spacing-md);
  border-radius: var(--hw-radius-sm);
  line-height: 1.6;
  color: var(--hw-text-primary);
}

.hw-report-chart {
  background: var(--hw-surface-sunken);
  border: 1px solid var(--hw-border-subtle);
  border-radius: var(--hw-radius-md);
  padding: var(--hw-spacing-md);
  margin: var(--hw-spacing-md) 0;
}

.hw-report-insights {
  display: flex;
  flex-direction: column;
  gap: var(--hw-spacing-sm);
}

.hw-report-insight {
  display: flex;
  align-items: flex-start;
  gap: var(--hw-spacing-sm);
  padding: var(--hw-spacing-sm);
  background: var(--hw-surface-sunken);
  border-radius: var(--hw-radius-sm);
}

.hw-report-insight::before {
  content: "💡";
  flex-shrink: 0;
  font-size: var(--hw-font-size-lg);
}

.hw-report-actions {
  display: flex;
  gap: var(--hw-spacing-sm);
  justify-content: flex-end;
  margin-top: var(--hw-spacing-lg);
  padding-top: var(--hw-spacing-lg);
  border-top: 1px solid var(--hw-border-subtle);
}
```

---

## Digital Twin Viewer

### 3D Viewer Container

```css
.hw-digital-twin-viewer {
  position: relative;
  width: 100%;
  height: 600px;
  background: var(--hw-builder-canvas);
  border-radius: var(--hw-radius-lg);
  overflow: hidden;
  border: 1px solid var(--hw-border-subtle);
}

.hw-digital-twin-canvas {
  width: 100%;
  height: 100%;
}

.hw-digital-twin-controls {
  position: absolute;
  top: var(--hw-spacing-md);
  right: var(--hw-spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--hw-spacing-sm);
}

.hw-twin-status-panel {
  position: absolute;
  bottom: var(--hw-spacing-md);
  left: var(--hw-spacing-md);
  background: var(--hw-glass-bg);
  backdrop-filter: blur(var(--hw-glass-blur));
  border: 1px solid var(--hw-glass-border);
  border-radius: var(--hw-radius-md);
  padding: var(--hw-spacing-md);
  min-width: 250px;
  max-width: 400px;
}

.hw-twin-status-panel h3 {
  margin: 0 0 var(--hw-spacing-sm) 0;
  font-size: var(--hw-font-size-md);
  font-weight: 600;
  color: var(--hw-text-primary);
}

.hw-status-indicator {
  display: inline-block;
  padding: var(--hw-spacing-xs) var(--hw-spacing-sm);
  border-radius: var(--hw-radius-sm);
  font-size: var(--hw-font-size-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--hw-spacing-sm);
}

.hw-status-indicator[data-status="operational"] {
  background: rgba(0, 255, 136, 0.2);
  color: var(--hw-twin-operational);
  border: 1px solid var(--hw-twin-operational);
}

.hw-status-indicator[data-status="warning"] {
  background: rgba(255, 170, 0, 0.2);
  color: var(--hw-twin-warning);
  border: 1px solid var(--hw-twin-warning);
}

.hw-status-indicator[data-status="critical"] {
  background: rgba(255, 51, 102, 0.2);
  color: var(--hw-twin-critical);
  border: 1px solid var(--hw-twin-critical);
  animation: criticalBlink 1s infinite;
}

@keyframes criticalBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.hw-status-indicator[data-status="offline"] {
  background: rgba(128, 128, 128, 0.2);
  color: var(--hw-twin-offline);
  border: 1px solid var(--hw-twin-offline);
}

.hw-sensor-reading {
  display: flex;
  justify-content: space-between;
  padding: var(--hw-spacing-xs) 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: var(--hw-font-size-sm);
}

.hw-sensor-reading:last-child {
  border-bottom: none;
}

.hw-sensor-reading span:first-child {
  color: var(--hw-text-secondary);
}

.hw-sensor-reading span:last-child {
  color: var(--hw-text-primary);
  font-weight: 600;
}
```

### Digital Twin Loading State

```css
.hw-twin-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: var(--hw-spacing-md);
}

.hw-twin-loading-spinner {
  width: 64px;
  height: 64px;
  border: 4px solid rgba(0, 212, 255, 0.2);
  border-top-color: var(--hw-twin-sync);
  border-radius: 50%;
  animation: spin var(--hw-twin-sync-duration) linear infinite;
}

.hw-twin-loading-text {
  color: var(--hw-text-secondary);
  font-size: var(--hw-font-size-sm);
}
```

---

## Accessibility

### ARIA Labels and Roles

```html
<!-- Voice Control -->
<button
  class="hw-voice-button"
  aria-label="Activate voice control"
  aria-pressed="false"
  role="button"
>
  <span class="hw-sr-only">Press to speak</span>
</button>

<!-- Predictive Suggestions -->
<div
  class="hw-predictive-suggestions"
  role="complementary"
  aria-label="Suggested actions"
>
  <div class="hw-suggestions-list" role="list">
    <button
      class="hw-suggestion-item"
      role="listitem"
      aria-label="Create work order suggestion"
    >
      <!-- Content -->
    </button>
  </div>
</div>

<!-- AR Controls -->
<button
  class="hw-ar-trigger"
  aria-label="Start augmented reality view"
  aria-describedby="ar-description"
>
  Start AR
</button>
<p id="ar-description" class="hw-sr-only">
  Activate camera to view asset information in augmented reality
</p>
```

### Screen Reader Only Class

```css
.hw-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### Focus States

```css
.hw-voice-button:focus-visible,
.hw-suggestion-item:focus-visible,
.hw-palette-item:focus-visible,
.hw-canvas-component:focus-visible {
  outline: 3px solid var(--hw-primary);
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .hw-voice-button {
    border: 2px solid currentColor;
  }

  .hw-ar-info-panel {
    border-width: 2px;
  }

  .hw-prediction-bg {
    background: rgba(100, 100, 255, 0.3);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .hw-voice-button,
  .hw-ar-marker,
  .hw-status-indicator,
  .hw-predictive-suggestions {
    animation: none;
  }

  * {
    transition: none !important;
  }
}
```

---

## Responsive Design

### Mobile Adaptations

```css
@media (max-width: 768px) {
  /* Voice button on mobile */
  .hw-voice-button {
    width: 56px;
    height: 56px;
    bottom: var(--hw-spacing-md);
    right: var(--hw-spacing-md);
  }

  .hw-voice-panel {
    bottom: calc(var(--hw-spacing-md) + 56px + var(--hw-spacing-sm));
    right: var(--hw-spacing-md);
    left: var(--hw-spacing-md);
    min-width: auto;
  }

  /* Predictive suggestions on mobile */
  .hw-predictive-suggestions {
    bottom: var(--hw-spacing-md);
    left: var(--hw-spacing-md);
    right: var(--hw-spacing-md);
    max-width: none;
  }

  /* App builder on mobile */
  .hw-builder-container {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto auto;
  }

  .hw-builder-sidebar {
    grid-column: 1;
    grid-row: 1;
    max-height: 200px;
  }

  .hw-builder-canvas {
    grid-column: 1;
    grid-row: 2;
  }

  .hw-builder-properties {
    grid-column: 1;
    grid-row: 3;
    max-height: 300px;
  }

  .hw-builder-toolbar {
    grid-column: 1;
    grid-row: 4;
  }

  /* Report generator on mobile */
  .hw-report-generator {
    padding: var(--hw-spacing-md);
  }

  .hw-report-preview {
    padding: var(--hw-spacing-md);
  }

  /* Digital twin viewer on mobile */
  .hw-digital-twin-viewer {
    height: 400px;
  }

  .hw-twin-status-panel {
    left: var(--hw-spacing-sm);
    right: var(--hw-spacing-sm);
    bottom: var(--hw-spacing-sm);
    min-width: auto;
  }
}
```

### Tablet Adaptations

```css
@media (min-width: 769px) and (max-width: 1024px) {
  .hw-builder-container {
    grid-template-columns: 200px 1fr 250px;
  }

  .hw-predictive-suggestions {
    max-width: 350px;
  }
}
```

---

## Animation Performance

### GPU Acceleration

```css
.hw-voice-button,
.hw-ar-marker,
.hw-predictive-suggestions,
.hw-canvas-component {
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* Remove will-change after animation completes */
.hw-animation-complete {
  will-change: auto;
}
```

### 60fps Animations

```css
/* Use transform and opacity only for animations */
.hw-smooth-animation {
  transition: transform 0.3s var(--hw-transition-smooth),
              opacity 0.3s var(--hw-transition-smooth);
}

/* Avoid animating layout properties */
.hw-avoid {
  /* DON'T animate: width, height, margin, padding, top, left */
  /* DO animate: transform, opacity */
}
```

---

## Dark/Light Mode Integration

```css
/* Automatic theme detection */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    /* Dark mode is default */
  }
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --hw-ar-overlay: rgba(255, 255, 255, 0.85);
    --hw-builder-canvas: #f5f5f5;
    --hw-builder-component: #ffffff;
  }
}

/* Manual theme override */
[data-theme="light"] {
  --hw-ar-overlay: rgba(255, 255, 255, 0.85);
  --hw-builder-canvas: #f5f5f5;
  --hw-builder-component: #ffffff;
  --hw-prediction-bg: rgba(100, 100, 255, 0.05);
}

[data-theme="dark"] {
  --hw-ar-overlay: rgba(10, 10, 10, 0.9);
  --hw-builder-canvas: #0a0a0a;
  --hw-builder-component: #1a1a1a;
}
```

---

## Document Control

- **Version:** 1.0
- **Last Updated:** 2025-12-30
- **Owner:** HubbleWave Design Team
- **Review Cycle:** Weekly during Phase 7 implementation
- **Related Documents:**
  - 00-PHASE-OVERVIEW.md
  - 01-IMPLEMENTATION-GUIDE.md
  - 03-PROTOTYPES.md
