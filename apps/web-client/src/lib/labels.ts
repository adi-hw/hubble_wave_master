/**
 * HubbleWave Platform Labels
 *
 * Centralized labels for consistent terminology across the platform.
 * Based on the HubbleWave terminology migration guide.
 *
 * Usage:
 *   import { labels } from '@/lib/labels';
 *   <h1>{labels.entities.collection.plural}</h1>
 *
 * Future: This can be extended with i18n support.
 */

export interface EntityLabel {
  singular: string;
  plural: string;
}

export const labels = {
  // ===== Brand =====
  brand: {
    name: 'HubbleWave',
    tagline: 'See Everything. Know Everything.',
    productTagline: 'Your workspace, your way.',
    studioTagline: 'Build anything. Control everything.',
    avaTagline: 'Ask anything. Get answers.',
  },

  // ===== Navigation =====
  nav: {
    home: 'Home',
    dashboard: 'Dashboard',
    studio: 'Studio',
    settings: 'Settings',
    profile: 'Profile',
    favorites: 'Favorites',
    recent: 'Recent',
    all: 'All',
  },

  // ===== Entities (Code → UI Label) =====
  entities: {
    // Core Platform
    workspace: { singular: 'Workspace', plural: 'Workspaces' } as EntityLabel,
    collection: { singular: 'Collection', plural: 'Collections' } as EntityLabel,
    property: { singular: 'Property', plural: 'Properties' } as EntityLabel,

    // People & Access
    user: { singular: 'User', plural: 'Users' } as EntityLabel,
    team: { singular: 'Team', plural: 'Teams' } as EntityLabel,
    role: { singular: 'Role', plural: 'Roles' } as EntityLabel,
    accessRule: { singular: 'Access Rule', plural: 'Access Rules' } as EntityLabel,

    // Automation & Process Flows
    automation: { singular: 'Automation', plural: 'Automations' } as EntityLabel,
    processFlow: { singular: 'Process Flow', plural: 'Process Flows' } as EntityLabel,
    approval: { singular: 'Approval', plural: 'Approvals' } as EntityLabel,

    // Communication
    template: { singular: 'Template', plural: 'Templates' } as EntityLabel,
    notification: { singular: 'Notification', plural: 'Notifications' } as EntityLabel,
    event: { singular: 'Event', plural: 'Events' } as EntityLabel,

    // SLA/OLA
    commitment: { singular: 'Commitment', plural: 'Commitments' } as EntityLabel,

    // Views & Forms
    view: { singular: 'View', plural: 'Views' } as EntityLabel,
    layout: { singular: 'Layout', plural: 'Layouts' } as EntityLabel,
    form: { singular: 'Form', plural: 'Forms' } as EntityLabel,

    // Other
    setting: { singular: 'Setting', plural: 'Settings' } as EntityLabel,
    activity: { singular: 'Activity', plural: 'Activity Log' } as EntityLabel,
    connection: { singular: 'Connection', plural: 'Connections' } as EntityLabel,
    helper: { singular: 'Helper', plural: 'Helpers' } as EntityLabel,
  },

  // ===== Actions =====
  actions: {
    // CRUD
    create: 'Create',
    save: 'Save',
    saveChanges: 'Save Changes',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    view: 'View',
    duplicate: 'Duplicate',

    // Navigation
    back: 'Back',
    next: 'Next',
    done: 'Done',
    close: 'Close',

    // Data
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    refresh: 'Refresh',
    export: 'Export',
    import: 'Import',

    // Selection
    select: 'Select',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',

    // Other
    confirm: 'Confirm',
    apply: 'Apply',
    reset: 'Reset',
    retry: 'Retry',
    undo: 'Undo',
    redo: 'Redo',
    copy: 'Copy',
    paste: 'Paste',
  },

  // ===== Status Values =====
  status: {
    active: 'Active',
    inactive: 'Inactive',
    invited: 'Invited',
    pending: 'Pending',
    suspended: 'Suspended',
    deleted: 'Deleted',
    draft: 'Draft',
    published: 'Published',
    archived: 'Archived',
    enabled: 'Enabled',
    disabled: 'Disabled',
  },

  // ===== Common Fields =====
  fields: {
    name: 'Name',
    code: 'Code',
    description: 'Description',
    status: 'Status',
    type: 'Type',
    category: 'Category',
    priority: 'Priority',
    created: 'Created',
    modified: 'Modified',
    createdBy: 'Created By',
    modifiedBy: 'Modified By',
    email: 'Email',
    phone: 'Phone',
    notes: 'Notes',
    tags: 'Tags',
  },

  // ===== Common UI Text =====
  ui: {
    loading: 'Loading...',
    saving: 'Saving...',
    noResults: 'No results found',
    noData: 'No data',
    empty: 'Empty',
    all: 'All',
    none: 'None',
    more: 'More',
    less: 'Less',
    showMore: 'Show more',
    showLess: 'Show less',
    required: 'Required',
    optional: 'Optional',
    yes: 'Yes',
    no: 'No',
    or: 'or',
    and: 'and',
  },

  // ===== Messages =====
  messages: {
    // Success
    saved: 'Saved successfully',
    created: 'Created successfully',
    updated: 'Updated successfully',
    deleted: 'Deleted successfully',
    copied: 'Copied to clipboard',

    // Errors
    error: 'An error occurred',
    notFound: 'Not found',
    unauthorized: 'You are not authorized',
    forbidden: 'Access denied',
    validationError: 'Please fix the errors below',

    // Confirmations
    confirmDelete: 'Are you sure you want to delete this?',
    confirmDiscard: 'Discard unsaved changes?',
    unsavedChanges: 'You have unsaved changes',
  },

  // ===== Placeholders =====
  placeholders: {
    search: 'Search...',
    searchCollection: 'Search collections...',
    searchUsers: 'Search users...',
    selectOption: 'Select an option',
    enterValue: 'Enter a value',
    typeToSearch: 'Type to search...',
  },

  // ===== Studio Sections =====
  studio: {
    schema: 'Schema',
    automations: 'Automations',
    flows: 'Flows',
    access: 'Access',
    templates: 'Templates',
    connections: 'Connections',
    users: 'Users',
    teams: 'Teams',
    roles: 'Roles',
    settings: 'Settings',
  },

  // ===== Dates & Time =====
  datetime: {
    today: 'Today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
    thisWeek: 'This week',
    lastWeek: 'Last week',
    thisMonth: 'This month',
    lastMonth: 'Last month',
    dateFormat: 'MMM d, yyyy',
    timeFormat: 'h:mm a',
    dateTimeFormat: 'MMM d, yyyy h:mm a',
  },
} as const;

/**
 * Get entity label with optional count for pluralization
 */
export function getEntityLabel(
  entity: keyof typeof labels.entities,
  count?: number
): string {
  const label = labels.entities[entity];
  if (count === undefined) return label.singular;
  return count === 1 ? label.singular : label.plural;
}

/**
 * Format a label with interpolation
 * @example formatLabel('Delete {name}?', { name: 'John' }) => 'Delete John?'
 */
export function formatLabel(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    String(values[key] ?? `{${key}}`)
  );
}

export default labels;
