# Phase 5: Integration & Data - UI Specifications

**Version:** 1.0
**Last Updated:** 2025-12-30
**Status:** Design Specification

---

## Table of Contents

1. [Design System](#design-system)
2. [API Explorer Interface](#api-explorer-interface)
3. [Webhook Management](#webhook-management)
4. [Integration Marketplace](#integration-marketplace)
5. [Data Mapper](#data-mapper)
6. [Import Wizard](#import-wizard)
7. [Export Interface](#export-interface)
8. [OAuth Configuration](#oauth-configuration)
9. [Sync Dashboard](#sync-dashboard)
10. [Connector Configuration](#connector-configuration)

---

## Design System

### CSS Custom Properties

```css
/* Integration-specific CSS variables */
:root {
  /* Integration Colors */
  --hw-integration-primary: #4F46E5;
  --hw-integration-success: #10B981;
  --hw-integration-warning: #F59E0B;
  --hw-integration-error: #EF4444;
  --hw-integration-info: #3B82F6;

  /* Status Colors */
  --hw-status-active: #10B981;
  --hw-status-inactive: #6B7280;
  --hw-status-error: #EF4444;
  --hw-status-pending: #F59E0B;
  --hw-status-syncing: #3B82F6;

  /* API Documentation Colors */
  --hw-api-get: #10B981;
  --hw-api-post: #3B82F6;
  --hw-api-put: #F59E0B;
  --hw-api-patch: #8B5CF6;
  --hw-api-delete: #EF4444;

  /* Connector Colors */
  --hw-connector-salesforce: #00A1E0;
  --hw-connector-jira: #0052CC;
  --hw-connector-servicenow: #62D84E;
  --hw-connector-sap: #0FAAFF;

  /* Spacing for Integration UI */
  --hw-integration-spacing-xs: 0.5rem;
  --hw-integration-spacing-sm: 0.75rem;
  --hw-integration-spacing-md: 1rem;
  --hw-integration-spacing-lg: 1.5rem;
  --hw-integration-spacing-xl: 2rem;

  /* Code/Console Font */
  --hw-font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;

  /* Border Radius */
  --hw-border-radius-sm: 4px;
  --hw-border-radius-md: 8px;
  --hw-border-radius-lg: 12px;

  /* Shadows */
  --hw-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --hw-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --hw-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --hw-shadow-code: 0 2px 8px rgba(0, 0, 0, 0.15);

  /* Transitions */
  --hw-transition-fast: 150ms ease;
  --hw-transition-normal: 250ms ease;
  --hw-transition-slow: 350ms ease;
}

/* Dark mode overrides */
[data-theme="dark"] {
  --hw-integration-primary: #6366F1;
  --hw-integration-success: #34D399;
  --hw-integration-warning: #FBBF24;
  --hw-integration-error: #F87171;
  --hw-integration-info: #60A5FA;
}
```

### Typography for Code/API Content

```css
.hw-code-block {
  font-family: var(--hw-font-mono);
  font-size: 0.875rem;
  line-height: 1.5;
  background: var(--hw-surface-elevated);
  border: 1px solid var(--hw-border-color);
  border-radius: var(--hw-border-radius-md);
  padding: var(--hw-integration-spacing-md);
  overflow-x: auto;
  box-shadow: var(--hw-shadow-code);
}

.hw-inline-code {
  font-family: var(--hw-font-mono);
  font-size: 0.875em;
  background: var(--hw-surface-elevated);
  padding: 0.125rem 0.375rem;
  border-radius: var(--hw-border-radius-sm);
  border: 1px solid var(--hw-border-color);
}

.hw-api-endpoint {
  font-family: var(--hw-font-mono);
  font-size: 0.875rem;
  font-weight: 600;
}
```

### HTTP Method Badges

```css
.hw-http-method {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.5rem;
  border-radius: var(--hw-border-radius-sm);
  font-family: var(--hw-font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  min-width: 60px;
}

.hw-http-method--get {
  background: var(--hw-api-get);
  color: white;
}

.hw-http-method--post {
  background: var(--hw-api-post);
  color: white;
}

.hw-http-method--put {
  background: var(--hw-api-put);
  color: white;
}

.hw-http-method--patch {
  background: var(--hw-api-patch);
  color: white;
}

.hw-http-method--delete {
  background: var(--hw-api-delete);
  color: white;
}
```

### Status Indicators

```css
.hw-status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-radius: var(--hw-border-radius-sm);
  font-size: 0.875rem;
  font-weight: 500;
}

.hw-status-indicator::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: hw-pulse 2s infinite;
}

.hw-status-indicator--active {
  background: color-mix(in srgb, var(--hw-status-active) 10%, transparent);
  color: var(--hw-status-active);
}

.hw-status-indicator--active::before {
  background: var(--hw-status-active);
}

.hw-status-indicator--inactive {
  background: color-mix(in srgb, var(--hw-status-inactive) 10%, transparent);
  color: var(--hw-status-inactive);
}

.hw-status-indicator--inactive::before {
  background: var(--hw-status-inactive);
  animation: none;
}

.hw-status-indicator--error {
  background: color-mix(in srgb, var(--hw-status-error) 10%, transparent);
  color: var(--hw-status-error);
}

.hw-status-indicator--error::before {
  background: var(--hw-status-error);
}

.hw-status-indicator--syncing {
  background: color-mix(in srgb, var(--hw-status-syncing) 10%, transparent);
  color: var(--hw-status-syncing);
}

.hw-status-indicator--syncing::before {
  background: var(--hw-status-syncing);
  animation: hw-pulse 1s infinite;
}

@keyframes hw-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

## API Explorer Interface

### Layout Structure

```html
<div class="hw-api-explorer">
  <!-- Sidebar Navigation -->
  <aside class="hw-api-explorer__sidebar">
    <div class="hw-api-explorer__search">
      <input
        type="search"
        class="hw-input hw-input--search"
        placeholder="Search endpoints..."
      />
    </div>

    <nav class="hw-api-explorer__nav">
      <!-- Grouped by resource -->
      <div class="hw-api-nav-group">
        <h3 class="hw-api-nav-group__title">Projects</h3>
        <ul class="hw-api-nav-group__list">
          <li class="hw-api-nav-item">
            <span class="hw-http-method hw-http-method--get">GET</span>
            <span class="hw-api-nav-item__path">/projects</span>
          </li>
          <li class="hw-api-nav-item">
            <span class="hw-http-method hw-http-method--get">GET</span>
            <span class="hw-api-nav-item__path">/projects/:id</span>
          </li>
          <li class="hw-api-nav-item">
            <span class="hw-http-method hw-http-method--post">POST</span>
            <span class="hw-api-nav-item__path">/projects</span>
          </li>
          <li class="hw-api-nav-item">
            <span class="hw-http-method hw-http-method--put">PUT</span>
            <span class="hw-api-nav-item__path">/projects/:id</span>
          </li>
          <li class="hw-api-nav-item">
            <span class="hw-http-method hw-http-method--delete">DELETE</span>
            <span class="hw-api-nav-item__path">/projects/:id</span>
          </li>
        </ul>
      </div>
    </nav>
  </aside>

  <!-- Main Content Area -->
  <main class="hw-api-explorer__content">
    <!-- Endpoint Header -->
    <header class="hw-api-endpoint-header">
      <div class="hw-api-endpoint-header__method">
        <span class="hw-http-method hw-http-method--get">GET</span>
        <code class="hw-api-endpoint">/api/v1/projects</code>
      </div>
      <p class="hw-api-endpoint-header__description">
        Retrieve a list of all projects with optional filtering and pagination
      </p>
    </header>

    <!-- Tabs: Documentation, Try It, Code Examples -->
    <div class="hw-tabs">
      <div class="hw-tabs__header">
        <button class="hw-tab hw-tab--active">Documentation</button>
        <button class="hw-tab">Try It</button>
        <button class="hw-tab">Code Examples</button>
      </div>

      <!-- Documentation Tab -->
      <div class="hw-tab-panel hw-tab-panel--active">
        <!-- Parameters Section -->
        <section class="hw-api-section">
          <h3 class="hw-api-section__title">Query Parameters</h3>
          <table class="hw-api-params-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Type</th>
                <th>Required</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code class="hw-inline-code">page</code></td>
                <td><span class="hw-type-badge">integer</span></td>
                <td><span class="hw-badge hw-badge--optional">Optional</span></td>
                <td>Page number (default: 1)</td>
              </tr>
              <tr>
                <td><code class="hw-inline-code">pageSize</code></td>
                <td><span class="hw-type-badge">integer</span></td>
                <td><span class="hw-badge hw-badge--optional">Optional</span></td>
                <td>Items per page (default: 20, max: 100)</td>
              </tr>
              <tr>
                <td><code class="hw-inline-code">status</code></td>
                <td><span class="hw-type-badge">string</span></td>
                <td><span class="hw-badge hw-badge--optional">Optional</span></td>
                <td>Filter by project status</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Response Section -->
        <section class="hw-api-section">
          <h3 class="hw-api-section__title">Response</h3>
          <div class="hw-api-response">
            <div class="hw-api-response__status">
              <span class="hw-badge hw-badge--success">200 OK</span>
            </div>
            <pre class="hw-code-block"><code>{
  "data": [
    {
      "id": "proj_1234567890",
      "name": "Website Redesign",
      "status": "active",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 20,
    "totalPages": 5,
    "totalItems": 94
  }
}</code></pre>
          </div>
        </section>
      </div>

      <!-- Try It Tab -->
      <div class="hw-tab-panel">
        <form class="hw-api-try-it">
          <!-- Authentication -->
          <div class="hw-form-group">
            <label class="hw-label">Authentication</label>
            <select class="hw-select">
              <option>API Key: My Production Key</option>
              <option>OAuth2: My App Token</option>
            </select>
          </div>

          <!-- Parameters -->
          <div class="hw-form-group">
            <label class="hw-label">Query Parameters</label>
            <div class="hw-param-inputs">
              <div class="hw-param-input">
                <input
                  type="text"
                  class="hw-input hw-input--sm"
                  placeholder="page"
                  value="1"
                />
              </div>
              <div class="hw-param-input">
                <input
                  type="text"
                  class="hw-input hw-input--sm"
                  placeholder="pageSize"
                  value="20"
                />
              </div>
              <div class="hw-param-input">
                <input
                  type="text"
                  class="hw-input hw-input--sm"
                  placeholder="status"
                />
              </div>
            </div>
          </div>

          <!-- Request Preview -->
          <div class="hw-form-group">
            <label class="hw-label">Request Preview</label>
            <pre class="hw-code-block"><code>GET https://api.hubblewave.com/v1/projects?page=1&pageSize=20
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json</code></pre>
          </div>

          <!-- Send Button -->
          <button type="submit" class="hw-button hw-button--primary">
            <span class="hw-icon">▶</span>
            Send Request
          </button>

          <!-- Response Area -->
          <div class="hw-api-response-area">
            <div class="hw-api-response-header">
              <span class="hw-badge hw-badge--success">200 OK</span>
              <span class="hw-response-time">Response time: 145ms</span>
            </div>
            <div class="hw-tabs hw-tabs--sm">
              <div class="hw-tabs__header">
                <button class="hw-tab hw-tab--active">Body</button>
                <button class="hw-tab">Headers</button>
                <button class="hw-tab">Cookies</button>
              </div>
              <div class="hw-tab-panel hw-tab-panel--active">
                <pre class="hw-code-block"><code>{
  "data": [...],
  "pagination": {...}
}</code></pre>
              </div>
            </div>
          </div>
        </form>
      </div>

      <!-- Code Examples Tab -->
      <div class="hw-tab-panel">
        <div class="hw-code-examples">
          <div class="hw-code-example-selector">
            <select class="hw-select">
              <option>JavaScript (fetch)</option>
              <option>Node.js (axios)</option>
              <option>Python (requests)</option>
              <option>cURL</option>
              <option>C# (HttpClient)</option>
            </select>
            <button class="hw-button hw-button--secondary hw-button--sm">
              <span class="hw-icon">📋</span>
              Copy
            </button>
          </div>
          <pre class="hw-code-block"><code>// JavaScript (fetch)
const response = await fetch('https://api.hubblewave.com/v1/projects?page=1&pageSize=20', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data);</code></pre>
        </div>
      </div>
    </div>
  </main>
</div>
```

### CSS Styles

```css
.hw-api-explorer {
  display: grid;
  grid-template-columns: 320px 1fr;
  height: 100vh;
  background: var(--hw-background);
}

.hw-api-explorer__sidebar {
  background: var(--hw-surface);
  border-right: 1px solid var(--hw-border-color);
  overflow-y: auto;
  padding: var(--hw-integration-spacing-lg);
}

.hw-api-explorer__search {
  margin-bottom: var(--hw-integration-spacing-lg);
}

.hw-api-nav-group {
  margin-bottom: var(--hw-integration-spacing-lg);
}

.hw-api-nav-group__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--hw-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--hw-integration-spacing-sm);
}

.hw-api-nav-group__list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.hw-api-nav-item {
  display: flex;
  align-items: center;
  gap: var(--hw-integration-spacing-sm);
  padding: var(--hw-integration-spacing-sm);
  border-radius: var(--hw-border-radius-sm);
  cursor: pointer;
  transition: background var(--hw-transition-fast);
}

.hw-api-nav-item:hover {
  background: var(--hw-surface-hover);
}

.hw-api-nav-item--active {
  background: var(--hw-surface-selected);
}

.hw-api-nav-item__path {
  font-family: var(--hw-font-mono);
  font-size: 0.875rem;
  flex: 1;
}

.hw-api-explorer__content {
  overflow-y: auto;
  padding: var(--hw-integration-spacing-xl);
}

.hw-api-endpoint-header {
  margin-bottom: var(--hw-integration-spacing-xl);
  padding-bottom: var(--hw-integration-spacing-lg);
  border-bottom: 1px solid var(--hw-border-color);
}

.hw-api-endpoint-header__method {
  display: flex;
  align-items: center;
  gap: var(--hw-integration-spacing-md);
  margin-bottom: var(--hw-integration-spacing-sm);
}

.hw-api-endpoint-header__description {
  color: var(--hw-text-secondary);
  font-size: 1rem;
  line-height: 1.5;
}

.hw-api-section {
  margin-bottom: var(--hw-integration-spacing-xl);
}

.hw-api-section__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: var(--hw-integration-spacing-md);
}

.hw-api-params-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--hw-surface);
  border: 1px solid var(--hw-border-color);
  border-radius: var(--hw-border-radius-md);
  overflow: hidden;
}

.hw-api-params-table th {
  background: var(--hw-surface-elevated);
  padding: var(--hw-integration-spacing-sm) var(--hw-integration-spacing-md);
  text-align: left;
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--hw-text-secondary);
  border-bottom: 1px solid var(--hw-border-color);
}

.hw-api-params-table td {
  padding: var(--hw-integration-spacing-sm) var(--hw-integration-spacing-md);
  border-bottom: 1px solid var(--hw-border-color);
}

.hw-api-params-table tr:last-child td {
  border-bottom: none;
}

.hw-type-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: var(--hw-surface-elevated);
  border: 1px solid var(--hw-border-color);
  border-radius: var(--hw-border-radius-sm);
  font-family: var(--hw-font-mono);
  font-size: 0.75rem;
  color: var(--hw-integration-primary);
}

.hw-api-try-it {
  display: flex;
  flex-direction: column;
  gap: var(--hw-integration-spacing-lg);
}

.hw-param-inputs {
  display: flex;
  flex-direction: column;
  gap: var(--hw-integration-spacing-sm);
}

.hw-api-response-area {
  margin-top: var(--hw-integration-spacing-lg);
  padding: var(--hw-integration-spacing-lg);
  background: var(--hw-surface);
  border: 1px solid var(--hw-border-color);
  border-radius: var(--hw-border-radius-md);
}

.hw-api-response-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--hw-integration-spacing-md);
}

.hw-response-time {
  font-size: 0.875rem;
  color: var(--hw-text-secondary);
}

.hw-code-examples {
  display: flex;
  flex-direction: column;
  gap: var(--hw-integration-spacing-md);
}

.hw-code-example-selector {
  display: flex;
  align-items: center;
  gap: var(--hw-integration-spacing-sm);
}
```

---

## Webhook Management

### Webhook List View

```html
<div class="hw-webhooks">
  <!-- Header -->
  <header class="hw-page-header">
    <div class="hw-page-header__content">
      <h1 class="hw-page-title">Webhooks</h1>
      <p class="hw-page-description">
        Configure webhooks to receive real-time notifications when events occur
      </p>
    </div>
    <button class="hw-button hw-button--primary">
      <span class="hw-icon">+</span>
      Create Webhook
    </button>
  </header>

  <!-- Filters -->
  <div class="hw-filters">
    <input
      type="search"
      class="hw-input hw-input--search"
      placeholder="Search webhooks..."
    />
    <select class="hw-select">
      <option>All Status</option>
      <option>Active</option>
      <option>Inactive</option>
      <option>Error</option>
    </select>
  </div>

  <!-- Webhooks List -->
  <div class="hw-webhooks-list">
    <div class="hw-webhook-card">
      <div class="hw-webhook-card__header">
        <div class="hw-webhook-card__info">
          <h3 class="hw-webhook-card__name">Project Creation Notification</h3>
          <code class="hw-webhook-card__url">https://api.example.com/webhooks/projects</code>
        </div>
        <div class="hw-webhook-card__actions">
          <span class="hw-status-indicator hw-status-indicator--active">Active</span>
          <button class="hw-icon-button" title="Edit">
            <span class="hw-icon">✏️</span>
          </button>
          <button class="hw-icon-button" title="Delete">
            <span class="hw-icon">🗑️</span>
          </button>
        </div>
      </div>

      <div class="hw-webhook-card__body">
        <div class="hw-webhook-events">
          <span class="hw-label">Events:</span>
          <div class="hw-webhook-events__list">
            <span class="hw-badge">project.created</span>
            <span class="hw-badge">project.updated</span>
          </div>
        </div>

        <div class="hw-webhook-stats">
          <div class="hw-stat">
            <span class="hw-stat__label">Deliveries (24h)</span>
            <span class="hw-stat__value">142</span>
          </div>
          <div class="hw-stat">
            <span class="hw-stat__label">Success Rate</span>
            <span class="hw-stat__value hw-stat__value--success">99.3%</span>
          </div>
          <div class="hw-stat">
            <span class="hw-stat__label">Avg Response</span>
            <span class="hw-stat__value">158ms</span>
          </div>
          <div class="hw-stat">
            <span class="hw-stat__label">Last Delivery</span>
            <span class="hw-stat__value">2 mins ago</span>
          </div>
        </div>
      </div>

      <div class="hw-webhook-card__footer">
        <button class="hw-button hw-button--secondary hw-button--sm">
          View Deliveries
        </button>
        <button class="hw-button hw-button--secondary hw-button--sm">
          Test Webhook
        </button>
      </div>
    </div>
  </div>
</div>
```

### Webhook Configuration Form

```html
<div class="hw-webhook-form">
  <form>
    <div class="hw-form-section">
      <h2 class="hw-form-section__title">Basic Information</h2>

      <div class="hw-form-group">
        <label class="hw-label" for="webhook-name">
          Webhook Name
          <span class="hw-required">*</span>
        </label>
        <input
          type="text"
          id="webhook-name"
          class="hw-input"
          placeholder="e.g., Project Creation Notification"
          required
        />
        <span class="hw-help-text">A descriptive name for this webhook</span>
      </div>

      <div class="hw-form-group">
        <label class="hw-label" for="webhook-url">
          Payload URL
          <span class="hw-required">*</span>
        </label>
        <input
          type="url"
          id="webhook-url"
          class="hw-input"
          placeholder="https://api.example.com/webhooks"
          required
        />
        <span class="hw-help-text">The endpoint that will receive webhook payloads</span>
      </div>
    </div>

    <div class="hw-form-section">
      <h2 class="hw-form-section__title">Events</h2>

      <div class="hw-form-group">
        <label class="hw-label">Select Events to Subscribe</label>
        <div class="hw-event-selector">
          <div class="hw-event-category">
            <div class="hw-event-category__header">
              <input type="checkbox" id="projects-all" class="hw-checkbox" />
              <label for="projects-all" class="hw-event-category__label">
                Projects (All)
              </label>
            </div>
            <div class="hw-event-category__items">
              <label class="hw-checkbox-label">
                <input type="checkbox" class="hw-checkbox" />
                <span>project.created</span>
              </label>
              <label class="hw-checkbox-label">
                <input type="checkbox" class="hw-checkbox" />
                <span>project.updated</span>
              </label>
              <label class="hw-checkbox-label">
                <input type="checkbox" class="hw-checkbox" />
                <span>project.deleted</span>
              </label>
            </div>
          </div>

          <div class="hw-event-category">
            <div class="hw-event-category__header">
              <input type="checkbox" id="tasks-all" class="hw-checkbox" />
              <label for="tasks-all" class="hw-event-category__label">
                Tasks (All)
              </label>
            </div>
            <div class="hw-event-category__items">
              <label class="hw-checkbox-label">
                <input type="checkbox" class="hw-checkbox" />
                <span>task.created</span>
              </label>
              <label class="hw-checkbox-label">
                <input type="checkbox" class="hw-checkbox" />
                <span>task.updated</span>
              </label>
              <label class="hw-checkbox-label">
                <input type="checkbox" class="hw-checkbox" />
                <span>task.completed</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="hw-form-section">
      <h2 class="hw-form-section__title">Security</h2>

      <div class="hw-form-group">
        <label class="hw-label" for="webhook-secret">Secret Key</label>
        <div class="hw-input-group">
          <input
            type="password"
            id="webhook-secret"
            class="hw-input"
            value="wh_sec_abc123def456"
            readonly
          />
          <button type="button" class="hw-button hw-button--secondary">
            Regenerate
          </button>
        </div>
        <span class="hw-help-text">
          Used to verify webhook signatures. Keep this secret safe.
        </span>
      </div>
    </div>

    <div class="hw-form-section">
      <h2 class="hw-form-section__title">Advanced Options</h2>

      <div class="hw-form-group">
        <label class="hw-checkbox-label hw-checkbox-label--lg">
          <input type="checkbox" class="hw-checkbox" />
          <div>
            <strong>Enable SSL Verification</strong>
            <p class="hw-help-text">Verify SSL certificates when delivering payloads</p>
          </div>
        </label>
      </div>

      <div class="hw-form-group">
        <label class="hw-label">Custom Headers</label>
        <div class="hw-key-value-editor">
          <div class="hw-key-value-row">
            <input type="text" class="hw-input hw-input--sm" placeholder="Header name" />
            <input type="text" class="hw-input hw-input--sm" placeholder="Header value" />
            <button type="button" class="hw-icon-button">
              <span class="hw-icon">🗑️</span>
            </button>
          </div>
          <button type="button" class="hw-button hw-button--secondary hw-button--sm">
            + Add Header
          </button>
        </div>
      </div>

      <div class="hw-form-group">
        <label class="hw-label" for="retry-attempts">Maximum Retry Attempts</label>
        <select id="retry-attempts" class="hw-select">
          <option>3 attempts</option>
          <option selected>5 attempts</option>
          <option>10 attempts</option>
          <option>20 attempts</option>
        </select>
      </div>
    </div>

    <div class="hw-form-actions">
      <button type="button" class="hw-button hw-button--secondary">
        Test Webhook
      </button>
      <div class="hw-form-actions__right">
        <button type="button" class="hw-button hw-button--ghost">
          Cancel
        </button>
        <button type="submit" class="hw-button hw-button--primary">
          Save Webhook
        </button>
      </div>
    </div>
  </form>
</div>
```

### Webhook Delivery Log

```html
<div class="hw-webhook-deliveries">
  <div class="hw-deliveries-header">
    <h2 class="hw-section-title">Recent Deliveries</h2>
    <div class="hw-deliveries-filters">
      <select class="hw-select hw-select--sm">
        <option>All Status</option>
        <option>Success</option>
        <option>Failed</option>
      </select>
      <select class="hw-select hw-select--sm">
        <option>Last 24 hours</option>
        <option>Last 7 days</option>
        <option>Last 30 days</option>
      </select>
    </div>
  </div>

  <div class="hw-deliveries-table">
    <table class="hw-table">
      <thead>
        <tr>
          <th>Event</th>
          <th>Status</th>
          <th>Response Time</th>
          <th>Attempts</th>
          <th>Timestamp</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <span class="hw-badge">project.created</span>
          </td>
          <td>
            <span class="hw-status-indicator hw-status-indicator--active">
              Success
            </span>
          </td>
          <td>145ms</td>
          <td>1/5</td>
          <td>
            <time datetime="2025-01-15T14:30:00">2 mins ago</time>
          </td>
          <td>
            <button class="hw-button hw-button--ghost hw-button--sm">
              View Details
            </button>
          </td>
        </tr>
        <tr>
          <td>
            <span class="hw-badge">project.updated</span>
          </td>
          <td>
            <span class="hw-status-indicator hw-status-indicator--error">
              Failed
            </span>
          </td>
          <td>5,000ms (timeout)</td>
          <td>5/5</td>
          <td>
            <time datetime="2025-01-15T14:25:00">7 mins ago</time>
          </td>
          <td>
            <button class="hw-button hw-button--ghost hw-button--sm">
              View Details
            </button>
            <button class="hw-button hw-button--ghost hw-button--sm">
              Retry
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

### CSS Styles for Webhooks

```css
.hw-webhooks-list {
  display: flex;
  flex-direction: column;
  gap: var(--hw-integration-spacing-md);
}

.hw-webhook-card {
  background: var(--hw-surface);
  border: 1px solid var(--hw-border-color);
  border-radius: var(--hw-border-radius-lg);
  overflow: hidden;
  transition: box-shadow var(--hw-transition-normal);
}

.hw-webhook-card:hover {
  box-shadow: var(--hw-shadow-md);
}

.hw-webhook-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--hw-integration-spacing-lg);
  border-bottom: 1px solid var(--hw-border-color);
}

.hw-webhook-card__info {
  flex: 1;
}

.hw-webhook-card__name {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: var(--hw-integration-spacing-xs);
}

.hw-webhook-card__url {
  font-family: var(--hw-font-mono);
  font-size: 0.875rem;
  color: var(--hw-text-secondary);
}

.hw-webhook-card__actions {
  display: flex;
  align-items: center;
  gap: var(--hw-integration-spacing-sm);
}

.hw-webhook-card__body {
  padding: var(--hw-integration-spacing-lg);
}

.hw-webhook-events {
  display: flex;
  align-items: center;
  gap: var(--hw-integration-spacing-sm);
  margin-bottom: var(--hw-integration-spacing-md);
}

.hw-webhook-events__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hw-integration-spacing-xs);
}

.hw-webhook-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--hw-integration-spacing-lg);
  padding: var(--hw-integration-spacing-md);
  background: var(--hw-surface-elevated);
  border-radius: var(--hw-border-radius-sm);
}

.hw-stat {
  display: flex;
  flex-direction: column;
}

.hw-stat__label {
  font-size: 0.75rem;
  color: var(--hw-text-secondary);
  margin-bottom: 0.25rem;
}

.hw-stat__value {
  font-size: 1.25rem;
  font-weight: 600;
}

.hw-stat__value--success {
  color: var(--hw-status-active);
}

.hw-webhook-card__footer {
  display: flex;
  gap: var(--hw-integration-spacing-sm);
  padding: var(--hw-integration-spacing-md) var(--hw-integration-spacing-lg);
  background: var(--hw-surface-elevated);
}

.hw-event-selector {
  display: flex;
  flex-direction: column;
  gap: var(--hw-integration-spacing-md);
  padding: var(--hw-integration-spacing-md);
  background: var(--hw-surface-elevated);
  border: 1px solid var(--hw-border-color);
  border-radius: var(--hw-border-radius-md);
  max-height: 400px;
  overflow-y: auto;
}

.hw-event-category {
  border-bottom: 1px solid var(--hw-border-color);
  padding-bottom: var(--hw-integration-spacing-md);
}

.hw-event-category:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.hw-event-category__header {
  display: flex;
  align-items: center;
  gap: var(--hw-integration-spacing-sm);
  margin-bottom: var(--hw-integration-spacing-sm);
}

.hw-event-category__label {
  font-weight: 600;
  font-size: 0.875rem;
}

.hw-event-category__items {
  display: flex;
  flex-direction: column;
  gap: var(--hw-integration-spacing-xs);
  padding-left: var(--hw-integration-spacing-xl);
}

.hw-key-value-editor {
  display: flex;
  flex-direction: column;
  gap: var(--hw-integration-spacing-sm);
}

.hw-key-value-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: var(--hw-integration-spacing-sm);
  align-items: center;
}
```

---

## Integration Marketplace

```html
<div class="hw-integration-marketplace">
  <!-- Header -->
  <header class="hw-marketplace-header">
    <h1 class="hw-page-title">Integration Marketplace</h1>
    <p class="hw-page-description">
      Connect HubbleWave with your favorite tools and services
    </p>
  </header>

  <!-- Search and Filters -->
  <div class="hw-marketplace-filters">
    <input
      type="search"
      class="hw-input hw-input--search hw-input--lg"
      placeholder="Search integrations..."
    />

    <div class="hw-filter-chips">
      <button class="hw-chip hw-chip--active">All</button>
      <button class="hw-chip">CRM</button>
      <button class="hw-chip">Project Management</button>
      <button class="hw-chip">ITSM</button>
      <button class="hw-chip">ERP</button>
      <button class="hw-chip">Communication</button>
    </div>
  </div>

  <!-- Integrations Grid -->
  <div class="hw-integrations-grid">
    <!-- Salesforce Card -->
    <div class="hw-integration-card">
      <div class="hw-integration-card__header">
        <img
          src="/assets/integrations/salesforce.svg"
          alt="Salesforce"
          class="hw-integration-card__logo"
        />
        <div class="hw-integration-card__badge">
          <span class="hw-badge hw-badge--success">Connected</span>
        </div>
      </div>

      <div class="hw-integration-card__body">
        <h3 class="hw-integration-card__name">Salesforce</h3>
        <p class="hw-integration-card__description">
          Sync customers, opportunities, and accounts between HubbleWave and Salesforce CRM
        </p>

        <div class="hw-integration-card__meta">
          <span class="hw-meta-item">
            <span class="hw-icon">⚡</span>
            Real-time sync
          </span>
          <span class="hw-meta-item">
            <span class="hw-icon">🔄</span>
            Bi-directional
          </span>
        </div>
      </div>

      <div class="hw-integration-card__footer">
        <button class="hw-button hw-button--secondary hw-button--block">
          Configure
        </button>
      </div>
    </div>

    <!-- Jira Card -->
    <div class="hw-integration-card">
      <div class="hw-integration-card__header">
        <img
          src="/assets/integrations/jira.svg"
          alt="Jira"
          class="hw-integration-card__logo"
        />
      </div>

      <div class="hw-integration-card__body">
        <h3 class="hw-integration-card__name">Jira</h3>
        <p class="hw-integration-card__description">
          Synchronize projects, issues, and workflows with Atlassian Jira
        </p>

        <div class="hw-integration-card__meta">
          <span class="hw-meta-item">
            <span class="hw-icon">⚡</span>
            Real-time sync
          </span>
          <span class="hw-meta-item">
            <span class="hw-icon">🔄</span>
            Bi-directional
          </span>
        </div>
      </div>

      <div class="hw-integration-card__footer">
        <button class="hw-button hw-button--primary hw-button--block">
          Connect
        </button>
      </div>
    </div>

    <!-- ServiceNow Card -->
    <div class="hw-integration-card">
      <div class="hw-integration-card__header">
        <img
          src="/assets/integrations/servicenow.svg"
          alt="ServiceNow"
          class="hw-integration-card__logo"
        />
      </div>

      <div class="hw-integration-card__body">
        <h3 class="hw-integration-card__name">ServiceNow</h3>
        <p class="hw-integration-card__description">
          Integrate incidents, requests, and CMDB with ServiceNow ITSM platform
        </p>

        <div class="hw-integration-card__meta">
          <span class="hw-meta-item">
            <span class="hw-icon">📅</span>
            Scheduled sync
          </span>
          <span class="hw-meta-item">
            <span class="hw-icon">🔄</span>
            Bi-directional
          </span>
        </div>
      </div>

      <div class="hw-integration-card__footer">
        <button class="hw-button hw-button--primary hw-button--block">
          Connect
        </button>
      </div>
    </div>

    <!-- SAP Card -->
    <div class="hw-integration-card">
      <div class="hw-integration-card__header">
        <img
          src="/assets/integrations/sap.svg"
          alt="SAP"
          class="hw-integration-card__logo"
        />
      </div>

      <div class="hw-integration-card__body">
        <h3 class="hw-integration-card__name">SAP</h3>
        <p class="hw-integration-card__description">
          Connect to SAP ERP for master data, purchase orders, and inventory management
        </p>

        <div class="hw-integration-card__meta">
          <span class="hw-meta-item">
            <span class="hw-icon">📅</span>
            Scheduled sync
          </span>
          <span class="hw-meta-item">
            <span class="hw-icon">➡️</span>
            One-way
          </span>
        </div>
      </div>

      <div class="hw-integration-card__footer">
        <button class="hw-button hw-button--primary hw-button--block">
          Connect
        </button>
      </div>
    </div>
  </div>
</div>
```

### CSS Styles for Marketplace

```css
.hw-integration-marketplace {
  padding: var(--hw-integration-spacing-xl);
  max-width: 1400px;
  margin: 0 auto;
}

.hw-marketplace-header {
  margin-bottom: var(--hw-integration-spacing-xl);
  text-align: center;
}

.hw-marketplace-filters {
  margin-bottom: var(--hw-integration-spacing-xl);
}

.hw-filter-chips {
  display: flex;
  gap: var(--hw-integration-spacing-sm);
  margin-top: var(--hw-integration-spacing-md);
  flex-wrap: wrap;
}

.hw-chip {
  padding: 0.5rem 1rem;
  border: 1px solid var(--hw-border-color);
  border-radius: 999px;
  background: var(--hw-surface);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all var(--hw-transition-fast);
}

.hw-chip:hover {
  background: var(--hw-surface-hover);
}

.hw-chip--active {
  background: var(--hw-integration-primary);
  color: white;
  border-color: var(--hw-integration-primary);
}

.hw-integrations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--hw-integration-spacing-lg);
}

.hw-integration-card {
  background: var(--hw-surface);
  border: 1px solid var(--hw-border-color);
  border-radius: var(--hw-border-radius-lg);
  overflow: hidden;
  transition: all var(--hw-transition-normal);
}

.hw-integration-card:hover {
  box-shadow: var(--hw-shadow-lg);
  transform: translateY(-2px);
}

.hw-integration-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hw-integration-spacing-lg);
  background: var(--hw-surface-elevated);
}

.hw-integration-card__logo {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.hw-integration-card__body {
  padding: var(--hw-integration-spacing-lg);
}

.hw-integration-card__name {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: var(--hw-integration-spacing-sm);
}

.hw-integration-card__description {
  color: var(--hw-text-secondary);
  font-size: 0.875rem;
  line-height: 1.5;
  margin-bottom: var(--hw-integration-spacing-md);
}

.hw-integration-card__meta {
  display: flex;
  gap: var(--hw-integration-spacing-md);
  font-size: 0.75rem;
  color: var(--hw-text-secondary);
}

.hw-meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.hw-integration-card__footer {
  padding: var(--hw-integration-spacing-md) var(--hw-integration-spacing-lg);
  background: var(--hw-surface-elevated);
  border-top: 1px solid var(--hw-border-color);
}
```

Due to length constraints, I'll continue with the remaining files in the next response. Let me create the rest of the documentation files.

