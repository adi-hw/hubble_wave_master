# Phase 6: AVA Intelligence - UI Specifications

**Design Guidelines for AVA User Interfaces**

---

## Table of Contents

1. [Design System Integration](#design-system-integration)
2. [AVA Chat Interface](#ava-chat-interface)
3. [Inline Suggestions](#inline-suggestions)
4. [Predictive Search](#predictive-search)
5. [Smart Form Filling](#smart-form-filling)
6. [Anomaly Alerts](#anomaly-alerts)
7. [Component Library](#component-library)
8. [Accessibility](#accessibility)
9. [Responsive Design](#responsive-design)

---

## Design System Integration

### CSS Custom Properties (Design Tokens)

All AVA components use HubbleWave design tokens with `--hw-*` prefix:

```css
/* AVA-specific color tokens */
:root {
  /* Primary AVA colors */
  --hw-ava-primary: #6366F1;
  --hw-ava-primary-hover: #4F46E5;
  --hw-ava-primary-active: #4338CA;
  --hw-ava-primary-light: #E0E7FF;
  --hw-ava-primary-dark: #312E81;

  /* AVA semantic colors */
  --hw-ava-success: #10B981;
  --hw-ava-warning: #F59E0B;
  --hw-ava-error: #EF4444;
  --hw-ava-info: #3B82F6;

  /* AVA background colors */
  --hw-ava-bg-primary: #FFFFFF;
  --hw-ava-bg-secondary: #F9FAFB;
  --hw-ava-bg-tertiary: #F3F4F6;
  --hw-ava-bg-overlay: rgba(0, 0, 0, 0.5);

  /* AVA text colors */
  --hw-ava-text-primary: #111827;
  --hw-ava-text-secondary: #6B7280;
  --hw-ava-text-tertiary: #9CA3AF;
  --hw-ava-text-inverse: #FFFFFF;

  /* AVA border colors */
  --hw-ava-border-primary: #E5E7EB;
  --hw-ava-border-secondary: #D1D5DB;
  --hw-ava-border-focus: #6366F1;

  /* AVA spacing scale */
  --hw-ava-space-xs: 0.25rem;   /* 4px */
  --hw-ava-space-sm: 0.5rem;    /* 8px */
  --hw-ava-space-md: 1rem;      /* 16px */
  --hw-ava-space-lg: 1.5rem;    /* 24px */
  --hw-ava-space-xl: 2rem;      /* 32px */
  --hw-ava-space-2xl: 3rem;     /* 48px */

  /* AVA typography */
  --hw-ava-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --hw-ava-font-mono: 'Monaco', 'Courier New', monospace;

  --hw-ava-font-size-xs: 0.75rem;   /* 12px */
  --hw-ava-font-size-sm: 0.875rem;  /* 14px */
  --hw-ava-font-size-md: 1rem;      /* 16px */
  --hw-ava-font-size-lg: 1.125rem;  /* 18px */
  --hw-ava-font-size-xl: 1.25rem;   /* 20px */

  --hw-ava-font-weight-normal: 400;
  --hw-ava-font-weight-medium: 500;
  --hw-ava-font-weight-semibold: 600;
  --hw-ava-font-weight-bold: 700;

  --hw-ava-line-height-tight: 1.25;
  --hw-ava-line-height-normal: 1.5;
  --hw-ava-line-height-relaxed: 1.75;

  /* AVA elevation (shadows) */
  --hw-ava-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --hw-ava-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --hw-ava-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --hw-ava-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);

  /* AVA border radius */
  --hw-ava-radius-sm: 0.25rem;  /* 4px */
  --hw-ava-radius-md: 0.5rem;   /* 8px */
  --hw-ava-radius-lg: 0.75rem;  /* 12px */
  --hw-ava-radius-xl: 1rem;     /* 16px */
  --hw-ava-radius-full: 9999px;

  /* AVA transitions */
  --hw-ava-transition-fast: 150ms ease-in-out;
  --hw-ava-transition-base: 250ms ease-in-out;
  --hw-ava-transition-slow: 350ms ease-in-out;

  /* AVA z-index scale */
  --hw-ava-z-dropdown: 1000;
  --hw-ava-z-sticky: 1020;
  --hw-ava-z-fixed: 1030;
  --hw-ava-z-modal-backdrop: 1040;
  --hw-ava-z-modal: 1050;
  --hw-ava-z-popover: 1060;
  --hw-ava-z-tooltip: 1070;

  /* AVA animations */
  --hw-ava-animation-slide-up: slideUp 0.3s ease-out;
  --hw-ava-animation-fade-in: fadeIn 0.2s ease-in;
  --hw-ava-animation-pulse: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Dark mode tokens */
[data-theme="dark"] {
  --hw-ava-bg-primary: #1F2937;
  --hw-ava-bg-secondary: #111827;
  --hw-ava-bg-tertiary: #0F172A;

  --hw-ava-text-primary: #F9FAFB;
  --hw-ava-text-secondary: #D1D5DB;
  --hw-ava-text-tertiary: #9CA3AF;

  --hw-ava-border-primary: #374151;
  --hw-ava-border-secondary: #4B5563;
}

/* Keyframe animations */
@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
```

---

## AVA Chat Interface

### Main Chat Panel

The primary interface for conversing with AVA.

**Desktop Layout:**

```html
<!-- AVA Chat Panel -->
<div class="hw-ava-chat-panel" data-state="minimized">
  <!-- Header -->
  <div class="hw-ava-chat-header">
    <div class="hw-ava-chat-header-content">
      <div class="hw-ava-avatar">
        <svg class="hw-ava-avatar-icon"><!-- AVA icon --></svg>
        <span class="hw-ava-status-indicator" data-status="online"></span>
      </div>
      <div class="hw-ava-chat-title">
        <h3 class="hw-ava-title-text">AVA</h3>
        <p class="hw-ava-subtitle-text">Autonomous Virtual Assistant</p>
      </div>
    </div>
    <div class="hw-ava-chat-actions">
      <button class="hw-ava-action-btn" data-action="minimize" aria-label="Minimize">
        <svg><!-- Minimize icon --></svg>
      </button>
      <button class="hw-ava-action-btn" data-action="close" aria-label="Close">
        <svg><!-- Close icon --></svg>
      </button>
    </div>
  </div>

  <!-- Messages Container -->
  <div class="hw-ava-chat-messages" role="log" aria-live="polite">
    <!-- Welcome message -->
    <div class="hw-ava-message" data-role="assistant">
      <div class="hw-ava-message-avatar">
        <svg class="hw-ava-avatar-icon"><!-- AVA icon --></svg>
      </div>
      <div class="hw-ava-message-content">
        <p class="hw-ava-message-text">
          Hi! I'm AVA, your intelligent assistant. How can I help you today?
        </p>
        <div class="hw-ava-quick-actions">
          <button class="hw-ava-quick-action-btn">Create Ticket</button>
          <button class="hw-ava-quick-action-btn">Search Assets</button>
          <button class="hw-ava-quick-action-btn">View My Tickets</button>
        </div>
      </div>
    </div>

    <!-- User message -->
    <div class="hw-ava-message" data-role="user">
      <div class="hw-ava-message-content">
        <p class="hw-ava-message-text">Show me all critical tickets</p>
        <span class="hw-ava-message-time">2:34 PM</span>
      </div>
    </div>

    <!-- Assistant message with data -->
    <div class="hw-ava-message" data-role="assistant">
      <div class="hw-ava-message-avatar">
        <svg class="hw-ava-avatar-icon"><!-- AVA icon --></svg>
      </div>
      <div class="hw-ava-message-content">
        <p class="hw-ava-message-text">
          You have 3 critical tickets assigned to you:
        </p>

        <!-- Ticket cards -->
        <div class="hw-ava-data-cards">
          <div class="hw-ava-card" data-type="ticket">
            <div class="hw-ava-card-header">
              <span class="hw-ava-card-badge" data-priority="critical">Critical</span>
              <span class="hw-ava-card-id">INC-4521</span>
            </div>
            <h4 class="hw-ava-card-title">Email server down</h4>
            <p class="hw-ava-card-meta">
              <span class="hw-ava-card-meta-item">
                <svg><!-- Clock icon --></svg>
                2h remaining SLA
              </span>
            </p>
            <div class="hw-ava-card-actions">
              <button class="hw-ava-card-action-btn">View</button>
              <button class="hw-ava-card-action-btn">Resolve</button>
            </div>
          </div>

          <div class="hw-ava-card" data-type="ticket">
            <div class="hw-ava-card-header">
              <span class="hw-ava-card-badge" data-priority="critical">Critical</span>
              <span class="hw-ava-card-id">INC-4518</span>
            </div>
            <h4 class="hw-ava-card-title">VPN connection issues</h4>
            <p class="hw-ava-card-meta">
              <span class="hw-ava-card-meta-item">
                <svg><!-- Clock icon --></svg>
                4h remaining
              </span>
            </p>
            <div class="hw-ava-card-actions">
              <button class="hw-ava-card-action-btn">View</button>
              <button class="hw-ava-card-action-btn">Resolve</button>
            </div>
          </div>
        </div>

        <span class="hw-ava-message-time">2:34 PM</span>
      </div>
    </div>

    <!-- Typing indicator -->
    <div class="hw-ava-typing-indicator" aria-label="AVA is typing">
      <div class="hw-ava-message-avatar">
        <svg class="hw-ava-avatar-icon"><!-- AVA icon --></svg>
      </div>
      <div class="hw-ava-typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </div>

  <!-- Input Area -->
  <div class="hw-ava-chat-input-area">
    <!-- Suggestions bar (optional) -->
    <div class="hw-ava-suggestions-bar" data-visible="true">
      <button class="hw-ava-suggestion-chip">
        <svg><!-- Icon --></svg>
        Create ticket
      </button>
      <button class="hw-ava-suggestion-chip">
        <svg><!-- Icon --></svg>
        Search knowledge
      </button>
    </div>

    <!-- Input container -->
    <div class="hw-ava-chat-input-container">
      <button class="hw-ava-input-action-btn" data-action="attach" aria-label="Attach file">
        <svg><!-- Paperclip icon --></svg>
      </button>

      <div class="hw-ava-input-wrapper">
        <textarea
          class="hw-ava-chat-input"
          placeholder="Ask AVA anything..."
          rows="1"
          aria-label="Chat with AVA"
        ></textarea>
      </div>

      <button class="hw-ava-input-action-btn" data-action="voice" aria-label="Voice input">
        <svg><!-- Microphone icon --></svg>
      </button>

      <button class="hw-ava-send-btn" aria-label="Send message">
        <svg><!-- Send icon --></svg>
      </button>
    </div>
  </div>
</div>

<!-- Minimized chat button -->
<button class="hw-ava-chat-trigger" aria-label="Open AVA chat">
  <svg class="hw-ava-trigger-icon"><!-- AVA icon --></svg>
  <span class="hw-ava-notification-badge" data-count="2">2</span>
</button>
```

**CSS Styling:**

```css
/* Chat Panel Container */
.hw-ava-chat-panel {
  position: fixed;
  bottom: var(--hw-ava-space-md);
  right: var(--hw-ava-space-md);
  width: 400px;
  max-height: 700px;
  background: var(--hw-ava-bg-primary);
  border: 1px solid var(--hw-ava-border-primary);
  border-radius: var(--hw-ava-radius-xl);
  box-shadow: var(--hw-ava-shadow-xl);
  display: flex;
  flex-direction: column;
  z-index: var(--hw-ava-z-fixed);
  animation: var(--hw-ava-animation-slide-up);
  transition: all var(--hw-ava-transition-base);
}

.hw-ava-chat-panel[data-state="minimized"] {
  display: none;
}

/* Header */
.hw-ava-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hw-ava-space-md);
  border-bottom: 1px solid var(--hw-ava-border-primary);
  background: linear-gradient(135deg, var(--hw-ava-primary) 0%, var(--hw-ava-primary-hover) 100%);
  color: var(--hw-ava-text-inverse);
  border-radius: var(--hw-ava-radius-xl) var(--hw-ava-radius-xl) 0 0;
}

.hw-ava-chat-header-content {
  display: flex;
  align-items: center;
  gap: var(--hw-ava-space-sm);
}

.hw-ava-avatar {
  position: relative;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--hw-ava-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hw-ava-avatar-icon {
  width: 24px;
  height: 24px;
  color: var(--hw-ava-text-inverse);
}

.hw-ava-status-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  border-radius: var(--hw-ava-radius-full);
  border: 2px solid var(--hw-ava-primary);
}

.hw-ava-status-indicator[data-status="online"] {
  background: var(--hw-ava-success);
}

.hw-ava-title-text {
  margin: 0;
  font-size: var(--hw-ava-font-size-lg);
  font-weight: var(--hw-ava-font-weight-semibold);
  line-height: var(--hw-ava-line-height-tight);
}

.hw-ava-subtitle-text {
  margin: 0;
  font-size: var(--hw-ava-font-size-xs);
  opacity: 0.9;
  line-height: var(--hw-ava-line-height-tight);
}

.hw-ava-chat-actions {
  display: flex;
  gap: var(--hw-ava-space-xs);
}

.hw-ava-action-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  width: 32px;
  height: 32px;
  border-radius: var(--hw-ava-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background var(--hw-ava-transition-fast);
}

.hw-ava-action-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.hw-ava-action-btn svg {
  width: 16px;
  height: 16px;
  color: var(--hw-ava-text-inverse);
}

/* Messages Container */
.hw-ava-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--hw-ava-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--hw-ava-space-md);
  scroll-behavior: smooth;
}

/* Message */
.hw-ava-message {
  display: flex;
  gap: var(--hw-ava-space-sm);
  animation: var(--hw-ava-animation-fade-in);
}

.hw-ava-message[data-role="user"] {
  flex-direction: row-reverse;
}

.hw-ava-message-avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  background: var(--hw-ava-primary-light);
  border-radius: var(--hw-ava-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hw-ava-message[data-role="assistant"] .hw-ava-message-avatar {
  background: var(--hw-ava-primary-light);
}

.hw-ava-message-avatar .hw-ava-avatar-icon {
  width: 20px;
  height: 20px;
  color: var(--hw-ava-primary);
}

.hw-ava-message-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--hw-ava-space-xs);
}

.hw-ava-message-text {
  margin: 0;
  padding: var(--hw-ava-space-sm) var(--hw-ava-space-md);
  background: var(--hw-ava-bg-secondary);
  border-radius: var(--hw-ava-radius-lg);
  font-size: var(--hw-ava-font-size-sm);
  line-height: var(--hw-ava-line-height-relaxed);
  color: var(--hw-ava-text-primary);
}

.hw-ava-message[data-role="user"] .hw-ava-message-text {
  background: var(--hw-ava-primary);
  color: var(--hw-ava-text-inverse);
  border-radius: var(--hw-ava-radius-lg) var(--hw-ava-radius-lg) 0 var(--hw-ava-radius-lg);
}

.hw-ava-message[data-role="assistant"] .hw-ava-message-text {
  border-radius: var(--hw-ava-radius-lg) var(--hw-ava-radius-lg) var(--hw-ava-radius-lg) 0;
}

.hw-ava-message-time {
  font-size: var(--hw-ava-font-size-xs);
  color: var(--hw-ava-text-tertiary);
  padding: 0 var(--hw-ava-space-sm);
}

/* Quick Actions */
.hw-ava-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hw-ava-space-xs);
  margin-top: var(--hw-ava-space-sm);
}

.hw-ava-quick-action-btn {
  padding: var(--hw-ava-space-xs) var(--hw-ava-space-md);
  background: var(--hw-ava-bg-primary);
  border: 1px solid var(--hw-ava-border-primary);
  border-radius: var(--hw-ava-radius-md);
  font-size: var(--hw-ava-font-size-sm);
  color: var(--hw-ava-primary);
  cursor: pointer;
  transition: all var(--hw-ava-transition-fast);
}

.hw-ava-quick-action-btn:hover {
  background: var(--hw-ava-primary-light);
  border-color: var(--hw-ava-primary);
}

/* Data Cards */
.hw-ava-data-cards {
  display: flex;
  flex-direction: column;
  gap: var(--hw-ava-space-sm);
  margin-top: var(--hw-ava-space-sm);
}

.hw-ava-card {
  background: var(--hw-ava-bg-primary);
  border: 1px solid var(--hw-ava-border-primary);
  border-radius: var(--hw-ava-radius-md);
  padding: var(--hw-ava-space-md);
  transition: all var(--hw-ava-transition-fast);
}

.hw-ava-card:hover {
  border-color: var(--hw-ava-primary);
  box-shadow: var(--hw-ava-shadow-md);
}

.hw-ava-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--hw-ava-space-sm);
}

.hw-ava-card-badge {
  padding: var(--hw-ava-space-xs) var(--hw-ava-space-sm);
  border-radius: var(--hw-ava-radius-sm);
  font-size: var(--hw-ava-font-size-xs);
  font-weight: var(--hw-ava-font-weight-medium);
  text-transform: uppercase;
}

.hw-ava-card-badge[data-priority="critical"] {
  background: #FEE2E2;
  color: #991B1B;
}

.hw-ava-card-badge[data-priority="high"] {
  background: #FEF3C7;
  color: #92400E;
}

.hw-ava-card-id {
  font-family: var(--hw-ava-font-mono);
  font-size: var(--hw-ava-font-size-xs);
  color: var(--hw-ava-text-secondary);
}

.hw-ava-card-title {
  margin: 0 0 var(--hw-ava-space-sm) 0;
  font-size: var(--hw-ava-font-size-md);
  font-weight: var(--hw-ava-font-weight-semibold);
  color: var(--hw-ava-text-primary);
}

.hw-ava-card-meta {
  display: flex;
  gap: var(--hw-ava-space-md);
  margin: 0 0 var(--hw-ava-space-md) 0;
}

.hw-ava-card-meta-item {
  display: flex;
  align-items: center;
  gap: var(--hw-ava-space-xs);
  font-size: var(--hw-ava-font-size-xs);
  color: var(--hw-ava-text-secondary);
}

.hw-ava-card-actions {
  display: flex;
  gap: var(--hw-ava-space-xs);
}

.hw-ava-card-action-btn {
  padding: var(--hw-ava-space-xs) var(--hw-ava-space-md);
  background: var(--hw-ava-bg-secondary);
  border: 1px solid var(--hw-ava-border-primary);
  border-radius: var(--hw-ava-radius-sm);
  font-size: var(--hw-ava-font-size-sm);
  color: var(--hw-ava-text-primary);
  cursor: pointer;
  transition: all var(--hw-ava-transition-fast);
}

.hw-ava-card-action-btn:hover {
  background: var(--hw-ava-primary);
  color: var(--hw-ava-text-inverse);
  border-color: var(--hw-ava-primary);
}

/* Typing Indicator */
.hw-ava-typing-indicator {
  display: flex;
  gap: var(--hw-ava-space-sm);
  animation: var(--hw-ava-animation-fade-in);
}

.hw-ava-typing-dots {
  background: var(--hw-ava-bg-secondary);
  border-radius: var(--hw-ava-radius-lg);
  padding: var(--hw-ava-space-sm) var(--hw-ava-space-md);
  display: flex;
  gap: var(--hw-ava-space-xs);
}

.hw-ava-typing-dots span {
  width: 8px;
  height: 8px;
  background: var(--hw-ava-text-tertiary);
  border-radius: var(--hw-ava-radius-full);
  animation: var(--hw-ava-animation-pulse);
}

.hw-ava-typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.hw-ava-typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

/* Input Area */
.hw-ava-chat-input-area {
  border-top: 1px solid var(--hw-ava-border-primary);
  padding: var(--hw-ava-space-md);
}

.hw-ava-suggestions-bar {
  display: flex;
  gap: var(--hw-ava-space-xs);
  margin-bottom: var(--hw-ava-space-sm);
  overflow-x: auto;
  padding-bottom: var(--hw-ava-space-xs);
}

.hw-ava-suggestions-bar[data-visible="false"] {
  display: none;
}

.hw-ava-suggestion-chip {
  display: flex;
  align-items: center;
  gap: var(--hw-ava-space-xs);
  padding: var(--hw-ava-space-xs) var(--hw-ava-space-md);
  background: var(--hw-ava-bg-secondary);
  border: 1px solid var(--hw-ava-border-primary);
  border-radius: var(--hw-ava-radius-full);
  font-size: var(--hw-ava-font-size-sm);
  color: var(--hw-ava-text-primary);
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--hw-ava-transition-fast);
}

.hw-ava-suggestion-chip:hover {
  background: var(--hw-ava-primary-light);
  border-color: var(--hw-ava-primary);
}

.hw-ava-chat-input-container {
  display: flex;
  align-items: flex-end;
  gap: var(--hw-ava-space-xs);
  background: var(--hw-ava-bg-secondary);
  border: 1px solid var(--hw-ava-border-primary);
  border-radius: var(--hw-ava-radius-lg);
  padding: var(--hw-ava-space-sm);
  transition: border-color var(--hw-ava-transition-fast);
}

.hw-ava-chat-input-container:focus-within {
  border-color: var(--hw-ava-border-focus);
}

.hw-ava-input-action-btn {
  flex-shrink: 0;
  background: transparent;
  border: none;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hw-ava-text-secondary);
  cursor: pointer;
  transition: color var(--hw-ava-transition-fast);
}

.hw-ava-input-action-btn:hover {
  color: var(--hw-ava-primary);
}

.hw-ava-input-action-btn svg {
  width: 20px;
  height: 20px;
}

.hw-ava-input-wrapper {
  flex: 1;
}

.hw-ava-chat-input {
  width: 100%;
  min-height: 32px;
  max-height: 120px;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-family: var(--hw-ava-font-family);
  font-size: var(--hw-ava-font-size-sm);
  color: var(--hw-ava-text-primary);
  line-height: var(--hw-ava-line-height-normal);
}

.hw-ava-chat-input::placeholder {
  color: var(--hw-ava-text-tertiary);
}

.hw-ava-send-btn {
  flex-shrink: 0;
  background: var(--hw-ava-primary);
  border: none;
  width: 32px;
  height: 32px;
  border-radius: var(--hw-ava-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hw-ava-text-inverse);
  cursor: pointer;
  transition: background var(--hw-ava-transition-fast);
}

.hw-ava-send-btn:hover {
  background: var(--hw-ava-primary-hover);
}

.hw-ava-send-btn:disabled {
  background: var(--hw-ava-bg-tertiary);
  color: var(--hw-ava-text-tertiary);
  cursor: not-allowed;
}

.hw-ava-send-btn svg {
  width: 16px;
  height: 16px;
}

/* Chat Trigger Button */
.hw-ava-chat-trigger {
  position: fixed;
  bottom: var(--hw-ava-space-md);
  right: var(--hw-ava-space-md);
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, var(--hw-ava-primary) 0%, var(--hw-ava-primary-hover) 100%);
  border: none;
  border-radius: var(--hw-ava-radius-full);
  box-shadow: var(--hw-ava-shadow-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: var(--hw-ava-z-fixed);
  transition: all var(--hw-ava-transition-base);
}

.hw-ava-chat-trigger:hover {
  transform: scale(1.05);
  box-shadow: var(--hw-ava-shadow-xl);
}

.hw-ava-trigger-icon {
  width: 32px;
  height: 32px;
  color: var(--hw-ava-text-inverse);
}

.hw-ava-notification-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  background: var(--hw-ava-error);
  color: var(--hw-ava-text-inverse);
  border-radius: var(--hw-ava-radius-full);
  font-size: var(--hw-ava-font-size-xs);
  font-weight: var(--hw-ava-font-weight-bold);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--hw-ava-space-xs);
  border: 2px solid var(--hw-ava-bg-primary);
}

/* Responsive Design */
@media (max-width: 768px) {
  .hw-ava-chat-panel {
    bottom: 0;
    right: 0;
    left: 0;
    width: 100%;
    max-height: 100vh;
    border-radius: 0;
    margin: 0;
  }

  .hw-ava-chat-header {
    border-radius: 0;
  }
}
```

---

## Inline Suggestions

Contextual AI suggestions that appear within forms and inputs.

**HTML Structure:**

```html
<!-- Inline suggestion in ticket form -->
<div class="hw-form-field">
  <label for="ticket-category" class="hw-form-label">Category</label>
  <div class="hw-input-with-suggestion">
    <input
      type="text"
      id="ticket-category"
      class="hw-form-input"
      placeholder="e.g., Hardware, Software, Network"
    />

    <!-- AVA Suggestion Popover -->
    <div class="hw-ava-inline-suggestion" data-visible="true">
      <div class="hw-ava-suggestion-header">
        <svg class="hw-ava-suggestion-icon"><!-- Sparkles icon --></svg>
        <span class="hw-ava-suggestion-label">AVA suggests</span>
      </div>
      <div class="hw-ava-suggestion-content">
        <button class="hw-ava-suggestion-item" data-confidence="high">
          <span class="hw-ava-suggestion-text">Hardware &gt; Printer</span>
          <span class="hw-ava-confidence-badge" data-level="high">95%</span>
        </button>
        <button class="hw-ava-suggestion-item" data-confidence="medium">
          <span class="hw-ava-suggestion-text">Hardware &gt; Desktop</span>
          <span class="hw-ava-confidence-badge" data-level="medium">78%</span>
        </button>
      </div>
      <div class="hw-ava-suggestion-footer">
        <button class="hw-ava-suggestion-dismiss">Dismiss</button>
      </div>
    </div>
  </div>
  <p class="hw-form-hint">Based on your description, AVA detected printer-related keywords</p>
</div>
```

**CSS Styling:**

```css
.hw-input-with-suggestion {
  position: relative;
}

.hw-ava-inline-suggestion {
  position: absolute;
  top: calc(100% + var(--hw-ava-space-xs));
  left: 0;
  right: 0;
  background: var(--hw-ava-bg-primary);
  border: 1px solid var(--hw-ava-primary);
  border-radius: var(--hw-ava-radius-md);
  box-shadow: var(--hw-ava-shadow-lg);
  padding: var(--hw-ava-space-md);
  z-index: var(--hw-ava-z-dropdown);
  animation: var(--hw-ava-animation-fade-in);
}

.hw-ava-inline-suggestion[data-visible="false"] {
  display: none;
}

.hw-ava-suggestion-header {
  display: flex;
  align-items: center;
  gap: var(--hw-ava-space-xs);
  margin-bottom: var(--hw-ava-space-sm);
}

.hw-ava-suggestion-icon {
  width: 16px;
  height: 16px;
  color: var(--hw-ava-primary);
}

.hw-ava-suggestion-label {
  font-size: var(--hw-ava-font-size-sm);
  font-weight: var(--hw-ava-font-weight-medium);
  color: var(--hw-ava-text-secondary);
}

.hw-ava-suggestion-content {
  display: flex;
  flex-direction: column;
  gap: var(--hw-ava-space-xs);
}

.hw-ava-suggestion-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hw-ava-space-sm);
  background: var(--hw-ava-bg-secondary);
  border: 1px solid var(--hw-ava-border-primary);
  border-radius: var(--hw-ava-radius-sm);
  text-align: left;
  cursor: pointer;
  transition: all var(--hw-ava-transition-fast);
}

.hw-ava-suggestion-item:hover {
  background: var(--hw-ava-primary-light);
  border-color: var(--hw-ava-primary);
}

.hw-ava-suggestion-text {
  font-size: var(--hw-ava-font-size-sm);
  color: var(--hw-ava-text-primary);
}

.hw-ava-confidence-badge {
  padding: 2px var(--hw-ava-space-xs);
  border-radius: var(--hw-ava-radius-sm);
  font-size: var(--hw-ava-font-size-xs);
  font-weight: var(--hw-ava-font-weight-medium);
}

.hw-ava-confidence-badge[data-level="high"] {
  background: #D1FAE5;
  color: #065F46;
}

.hw-ava-confidence-badge[data-level="medium"] {
  background: #FEF3C7;
  color: #92400E;
}

.hw-ava-suggestion-footer {
  margin-top: var(--hw-ava-space-sm);
  padding-top: var(--hw-ava-space-sm);
  border-top: 1px solid var(--hw-ava-border-primary);
}

.hw-ava-suggestion-dismiss {
  background: transparent;
  border: none;
  padding: 0;
  font-size: var(--hw-ava-font-size-xs);
  color: var(--hw-ava-text-tertiary);
  cursor: pointer;
  transition: color var(--hw-ava-transition-fast);
}

.hw-ava-suggestion-dismiss:hover {
  color: var(--hw-ava-text-primary);
}
```

---

## Predictive Search

Smart search with real-time suggestions and predictions.

**HTML Structure:**

```html
<div class="hw-ava-predictive-search">
  <div class="hw-search-input-container">
    <svg class="hw-search-icon"><!-- Search icon --></svg>
    <input
      type="text"
      class="hw-search-input"
      placeholder="Search tickets, assets, or ask AVA..."
      aria-label="Search"
      aria-controls="search-results"
      aria-autocomplete="list"
    />
    <button class="hw-search-voice-btn" aria-label="Voice search">
      <svg><!-- Microphone icon --></svg>
    </button>
  </div>

  <!-- Predictive Results -->
  <div class="hw-search-results" id="search-results" role="listbox">
    <!-- AVA Answers Section -->
    <div class="hw-search-section">
      <div class="hw-search-section-header">
        <svg class="hw-ava-suggestion-icon"><!-- AVA icon --></svg>
        <h4 class="hw-search-section-title">AVA Answers</h4>
      </div>
      <div class="hw-search-answer">
        <p class="hw-search-answer-text">
          You have 12 open tickets. 3 are high priority and need attention.
        </p>
        <button class="hw-search-answer-action">View all tickets</button>
      </div>
    </div>

    <!-- Recent Searches -->
    <div class="hw-search-section">
      <h4 class="hw-search-section-title">Recent</h4>
      <div class="hw-search-items">
        <button class="hw-search-item" role="option">
          <svg class="hw-search-item-icon"><!-- Clock icon --></svg>
          <span class="hw-search-item-text">Critical tickets last week</span>
        </button>
      </div>
    </div>

    <!-- Suggested Results -->
    <div class="hw-search-section">
      <h4 class="hw-search-section-title">Suggested</h4>
      <div class="hw-search-items">
        <button class="hw-search-item" role="option">
          <span class="hw-search-item-badge" data-type="ticket">Ticket</span>
          <div class="hw-search-item-content">
            <span class="hw-search-item-title">INC-4521: Email server down</span>
            <span class="hw-search-item-meta">Critical · 2h ago</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</div>
```

---

## Smart Form Filling

Auto-filled form fields based on context and history.

**Visual Indicator:**

```html
<div class="hw-form-field">
  <label for="assignee" class="hw-form-label">
    Assignee
    <span class="hw-ava-auto-filled-badge">
      <svg><!-- Sparkles icon --></svg>
      Auto-filled by AVA
    </span>
  </label>
  <input
    type="text"
    id="assignee"
    class="hw-form-input hw-ava-auto-filled"
    value="John Doe (Network Team)"
    readonly
  />
  <p class="hw-form-hint">
    Based on similar tickets, AVA assigned this to the Network Team
    <button class="hw-ava-change-btn">Change</button>
  </p>
</div>
```

**CSS:**

```css
.hw-ava-auto-filled-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--hw-ava-primary-light);
  color: var(--hw-ava-primary);
  border-radius: var(--hw-ava-radius-sm);
  font-size: var(--hw-ava-font-size-xs);
  font-weight: var(--hw-ava-font-weight-medium);
  margin-left: var(--hw-ava-space-xs);
}

.hw-form-input.hw-ava-auto-filled {
  border-color: var(--hw-ava-primary);
  background: var(--hw-ava-primary-light);
}

.hw-ava-change-btn {
  background: transparent;
  border: none;
  padding: 0;
  color: var(--hw-ava-primary);
  font-size: var(--hw-ava-font-size-xs);
  text-decoration: underline;
  cursor: pointer;
  margin-left: var(--hw-ava-space-xs);
}
```

---

## Anomaly Alerts

Proactive notifications about detected anomalies.

**HTML Structure:**

```html
<div class="hw-ava-anomaly-alert" data-severity="high">
  <div class="hw-anomaly-alert-icon">
    <svg><!-- Alert triangle icon --></svg>
  </div>
  <div class="hw-anomaly-alert-content">
    <div class="hw-anomaly-alert-header">
      <h4 class="hw-anomaly-alert-title">Unusual ticket spike detected</h4>
      <span class="hw-anomaly-alert-time">2 min ago</span>
    </div>
    <p class="hw-anomaly-alert-description">
      45 password reset requests in the last hour (8/hour avg).
      Possible AD service disruption (70% probability).
    </p>
    <div class="hw-anomaly-alert-actions">
      <button class="hw-anomaly-action-btn hw-anomaly-action-primary">
        Investigate
      </button>
      <button class="hw-anomaly-action-btn">
        Create incident
      </button>
      <button class="hw-anomaly-action-btn">
        Dismiss
      </button>
    </div>
  </div>
</div>
```

**CSS:**

```css
.hw-ava-anomaly-alert {
  display: flex;
  gap: var(--hw-ava-space-md);
  padding: var(--hw-ava-space-md);
  background: var(--hw-ava-bg-primary);
  border-left: 4px solid var(--hw-ava-warning);
  border-radius: var(--hw-ava-radius-md);
  box-shadow: var(--hw-ava-shadow-md);
  animation: var(--hw-ava-animation-slide-up);
}

.hw-ava-anomaly-alert[data-severity="high"] {
  border-left-color: var(--hw-ava-error);
}

.hw-ava-anomaly-alert[data-severity="medium"] {
  border-left-color: var(--hw-ava-warning);
}

.hw-ava-anomaly-alert[data-severity="low"] {
  border-left-color: var(--hw-ava-info);
}

.hw-anomaly-alert-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  background: #FEF3C7;
  border-radius: var(--hw-ava-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hw-ava-anomaly-alert[data-severity="high"] .hw-anomaly-alert-icon {
  background: #FEE2E2;
  color: #991B1B;
}

.hw-anomaly-alert-icon svg {
  width: 24px;
  height: 24px;
}

.hw-anomaly-alert-content {
  flex: 1;
}

.hw-anomaly-alert-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--hw-ava-space-xs);
}

.hw-anomaly-alert-title {
  margin: 0;
  font-size: var(--hw-ava-font-size-md);
  font-weight: var(--hw-ava-font-weight-semibold);
  color: var(--hw-ava-text-primary);
}

.hw-anomaly-alert-time {
  font-size: var(--hw-ava-font-size-xs);
  color: var(--hw-ava-text-tertiary);
}

.hw-anomaly-alert-description {
  margin: 0 0 var(--hw-ava-space-md) 0;
  font-size: var(--hw-ava-font-size-sm);
  color: var(--hw-ava-text-secondary);
  line-height: var(--hw-ava-line-height-relaxed);
}

.hw-anomaly-alert-actions {
  display: flex;
  gap: var(--hw-ava-space-xs);
}

.hw-anomaly-action-btn {
  padding: var(--hw-ava-space-xs) var(--hw-ava-space-md);
  background: var(--hw-ava-bg-secondary);
  border: 1px solid var(--hw-ava-border-primary);
  border-radius: var(--hw-ava-radius-sm);
  font-size: var(--hw-ava-font-size-sm);
  color: var(--hw-ava-text-primary);
  cursor: pointer;
  transition: all var(--hw-ava-transition-fast);
}

.hw-anomaly-action-btn:hover {
  background: var(--hw-ava-bg-tertiary);
}

.hw-anomaly-action-primary {
  background: var(--hw-ava-primary);
  color: var(--hw-ava-text-inverse);
  border-color: var(--hw-ava-primary);
}

.hw-anomaly-action-primary:hover {
  background: var(--hw-ava-primary-hover);
}
```

---

## Component Library

All AVA UI components follow the HubbleWave design system and use CSS custom properties for consistent theming and easy customization. Components are fully accessible, responsive, and optimized for performance.

**Key Principles:**

1. **Design Token First**: All styling uses `--hw-*` CSS variables
2. **Semantic HTML**: Proper ARIA labels and roles
3. **Responsive**: Mobile-first approach
4. **Performance**: Minimal re-renders, optimized animations
5. **Accessibility**: WCAG 2.1 AA compliant
6. **Dark Mode**: Full dark mode support via `data-theme` attribute

---

## Accessibility

All AVA components meet WCAG 2.1 Level AA standards:

- **Keyboard Navigation**: Full keyboard support (Tab, Enter, Escape)
- **Screen Reader**: Proper ARIA labels and live regions
- **Focus Management**: Visible focus indicators
- **Color Contrast**: Minimum 4.5:1 ratio for text
- **Voice Input**: Integrated voice commands
- **Reduced Motion**: Respects `prefers-reduced-motion`

---

## Responsive Design

**Breakpoints:**

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

**Mobile-specific behaviors:**

- Full-screen chat interface
- Bottom sheet for suggestions
- Simplified card layouts
- Touch-optimized hit targets (min 44x44px)

---

This UI specification ensures consistent, accessible, and beautiful AVA experiences across all HubbleWave touchpoints.
