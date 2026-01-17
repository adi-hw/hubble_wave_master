import { Injectable } from '@nestjs/common';

/**
 * Platform Knowledge Service
 * Provides AVA with knowledge about HubbleWave platform capabilities,
 * features, modules, and technical specifications.
 *
 * This is the platform's "self-knowledge" that AVA can use to:
 * 1. Answer questions about what the platform can do
 * 2. Guide users to the right features
 * 3. Explain capabilities without revealing proprietary code
 */

export interface PlatformCapability {
  code: string;
  name: string;
  description: string;
  category: PlatformCategory;
  module?: string;
  features: string[];
  useCases: string[];
  relatedCapabilities: string[];
  adminOnly?: boolean;
  enterpriseOnly?: boolean;
}

export type PlatformCategory =
  | 'core'
  | 'itil'
  | 'asset_management'
  | 'service_catalog'
  | 'knowledge_management'
  | 'automation'
  | 'integration'
  | 'reporting'
  | 'ai'
  | 'security'
  | 'customization'
  | 'administration';

export interface PlatformModule {
  code: string;
  name: string;
  description: string;
  capabilities: string[];
  isCore: boolean;
  isEnterprise: boolean;
}

export interface PlatformFeature {
  code: string;
  name: string;
  description: string;
  howToUse: string;
  tips: string[];
  limitations?: string[];
  relatedFeatures: string[];
}

@Injectable()
export class PlatformKnowledgeService {
  /**
   * All platform capabilities that AVA can explain to users
   */
  private readonly capabilities: PlatformCapability[] = [
    // Core Platform
    {
      code: 'collections',
      name: 'Collections (Schema Engine)',
      description: 'Create and manage custom data tables with properties, validations, and relationships. Collections are the foundation for storing any type of business data.',
      category: 'core',
      features: [
        'Define custom collections with flexible schemas',
        'Add properties of various types (text, number, date, reference, etc.)',
        'Set up relationships between collections',
        'Configure validation rules and defaults',
        'Enable attachments and comments',
        'Full audit trail of changes',
      ],
      useCases: [
        'Create a custom asset inventory',
        'Build a project tracking system',
        'Design a vendor management database',
        'Track contracts and agreements',
      ],
      relatedCapabilities: ['views', 'forms', 'business_rules'],
    },
    {
      code: 'views',
      name: 'Views Engine',
      description: 'Create custom list views, filters, and data visualizations for any collection. Users can create personal views or admins can create shared views.',
      category: 'core',
      features: [
        'Create list views with custom columns',
        'Add filters and sorting',
        'Save personal or shared views',
        'Group by columns',
        'Inline editing support',
        'Export to CSV/Excel',
      ],
      useCases: [
        'Create a view of all open incidents assigned to you',
        'Build a dashboard showing high-priority items',
        'Filter records by date range or status',
      ],
      relatedCapabilities: ['collections', 'reports', 'analytics'],
    },
    {
      code: 'forms',
      name: 'Form Designer',
      description: 'Design custom forms for data entry with layouts, sections, and conditional fields. Forms can be tailored per role or use case.',
      category: 'core',
      features: [
        'Drag-and-drop form builder',
        'Multi-column layouts',
        'Conditional field visibility',
        'Field grouping and sections',
        'Read-only and required field settings',
        'Form variants by role',
      ],
      useCases: [
        'Simplify incident creation for end users',
        'Create detailed asset onboarding forms',
        'Build approval request forms',
      ],
      relatedCapabilities: ['collections', 'business_rules'],
    },

    // ITIL / IT Service Management
    {
      code: 'incident_management',
      name: 'Incident Management',
      description: 'Track and resolve IT incidents with prioritization, assignment, escalation, and SLA tracking. Full ITIL-aligned incident lifecycle.',
      category: 'itil',
      module: 'itsm',
      features: [
        'Incident creation and categorization',
        'Priority and urgency matrix',
        'Assignment to individuals or groups',
        'SLA tracking and alerts',
        'Related incidents and problems',
        'Resolution and closure process',
        'Knowledge article suggestions',
      ],
      useCases: [
        'Report and track IT issues',
        'Escalate critical incidents',
        'Link incidents to known problems',
        'Track mean time to resolution',
      ],
      relatedCapabilities: ['problem_management', 'knowledge_base', 'sla_management'],
    },
    {
      code: 'request_fulfillment',
      name: 'Service Request Fulfillment',
      description: 'Handle service requests from the catalog with approval process flows, task assignment, and fulfillment tracking.',
      category: 'itil',
      module: 'itsm',
      features: [
        'Request submission from catalog',
        'Multi-level approval process flows',
        'Task breakdown and assignment',
        'Status tracking for requesters',
        'Fulfillment templates',
        'Request history and audit',
      ],
      useCases: [
        'Request new software installation',
        'Apply for access to systems',
        'Order IT equipment',
        'Request account modifications',
      ],
      relatedCapabilities: ['service_catalog', 'approvals', 'process_flow_automation'],
    },
    {
      code: 'change_management',
      name: 'Change Management',
      description: 'Plan, approve, and implement changes with risk assessment, change advisory board (CAB) reviews, and implementation tracking.',
      category: 'itil',
      module: 'itsm',
      features: [
        'Change request creation',
        'Risk and impact assessment',
        'CAB review process',
        'Change calendar',
        'Implementation planning',
        'Post-implementation review',
        'Emergency change handling',
      ],
      useCases: [
        'Plan a server migration',
        'Request a network change',
        'Schedule maintenance windows',
        'Track change success rates',
      ],
      relatedCapabilities: ['incident_management', 'cmdb', 'process_flow_automation'],
    },
    {
      code: 'problem_management',
      name: 'Problem Management',
      description: 'Identify root causes of recurring incidents, manage known errors, and implement permanent fixes.',
      category: 'itil',
      module: 'itsm',
      features: [
        'Problem investigation and RCA',
        'Known error database',
        'Workaround documentation',
        'Related incident linking',
        'Problem resolution tracking',
      ],
      useCases: [
        'Investigate recurring incidents',
        'Document known errors with workarounds',
        'Track problem to permanent fix',
      ],
      relatedCapabilities: ['incident_management', 'knowledge_base'],
    },

    // Asset Management
    {
      code: 'asset_management',
      name: 'Asset Management',
      description: 'Track hardware, software, and other assets throughout their lifecycle with discovery, inventory, and depreciation tracking.',
      category: 'asset_management',
      module: 'asset',
      features: [
        'Asset inventory and discovery',
        'Hardware and software tracking',
        'Asset lifecycle management',
        'Depreciation calculations',
        'Warranty and contract tracking',
        'Asset relationships (parent/child)',
        'Location and assignment tracking',
      ],
      useCases: [
        'Track all company laptops',
        'Manage software licenses',
        'Plan hardware refresh cycles',
        'Track asset costs and depreciation',
      ],
      relatedCapabilities: ['cmdb', 'contract_management', 'discovery'],
    },
    {
      code: 'cmdb',
      name: 'Configuration Management Database (CMDB)',
      description: 'Maintain a database of configuration items (CIs) and their relationships to support change impact analysis and incident resolution.',
      category: 'asset_management',
      module: 'asset',
      features: [
        'Configuration item management',
        'CI relationships and dependencies',
        'Relationship visualization',
        'Impact analysis',
        'CI attributes and classes',
        'Discovery integration',
      ],
      useCases: [
        'See what depends on a server before making changes',
        'Understand the infrastructure behind a service',
        'Analyze impact of outages',
      ],
      relatedCapabilities: ['asset_management', 'change_management', 'discovery'],
    },

    // Service Catalog
    {
      code: 'service_catalog',
      name: 'Service Catalog',
      description: 'Publish a catalog of IT services and products that users can request, with categories, pricing, and fulfillment process flows.',
      category: 'service_catalog',
      module: 'catalog',
      features: [
        'Service and product definitions',
        'Category organization',
        'Pricing and cost centers',
        'Request forms per item',
        'Approval process flows',
        'Fulfillment templates',
        'Self-service portal',
      ],
      useCases: [
        'Publish IT services for employees',
        'Set up hardware ordering catalog',
        'Create software request options',
      ],
      relatedCapabilities: ['request_fulfillment', 'approvals', 'portal'],
    },

    // Knowledge Management
    {
      code: 'knowledge_base',
      name: 'Knowledge Base',
      description: 'Create, publish, and maintain knowledge articles for self-service support and agent reference. AI-powered search and suggestions.',
      category: 'knowledge_management',
      module: 'knowledge',
      features: [
        'Article creation and editing',
        'Categories and tags',
        'Version history',
        'Approval process flows for publishing',
        'AI-powered search',
        'Article ratings and feedback',
        'Related article suggestions',
        'Article usage analytics',
      ],
      useCases: [
        'Document common IT solutions',
        'Create how-to guides',
        'Build FAQs for users',
        'Share troubleshooting steps',
      ],
      relatedCapabilities: ['ai_search', 'portal', 'incident_management'],
    },

    // Automation
    {
      code: 'business_rules',
      name: 'Business Rules',
      description: 'Automate actions when records are created, updated, or deleted. Set property values, send notifications, and trigger process flows.',
      category: 'automation',
      features: [
        'Trigger on record events (insert, update, delete)',
        'Condition-based execution',
        'Set field values automatically',
        'Send email notifications',
        'Create related records',
        'Call external webhooks',
        'Script-based advanced rules',
      ],
      useCases: [
        'Auto-assign incidents based on category',
        'Send notification when SLA is at risk',
        'Set default values on record creation',
        'Escalate after X hours without response',
      ],
      relatedCapabilities: ['process_flow_automation', 'notifications', 'scripts'],
    },
    {
      code: 'process_flow_automation',
      name: 'Process Flow Automation',
      description: 'Design multi-step approval and fulfillment process flows with parallel/serial steps, conditions, and automatic transitions.',
      category: 'automation',
      features: [
        'Visual process flow designer',
        'Approval steps with multiple approvers',
        'Parallel and serial execution',
        'Conditional branching',
        'Automatic state transitions',
        'Task assignments',
        'Due dates and reminders',
      ],
      useCases: [
        'Build a change approval process flow',
        'Create a hiring approval process',
        'Design a purchase request flow',
      ],
      relatedCapabilities: ['business_rules', 'approvals', 'notifications'],
    },
    {
      code: 'scripts',
      name: 'Server-side Scripts',
      description: 'Write JavaScript code for complex automation logic that runs on the server when triggered by events or scheduled jobs.',
      category: 'automation',
      adminOnly: true,
      features: [
        'Before/after event scripts',
        'Scheduled jobs',
        'REST API scripts',
        'Access to platform APIs',
        'Script includes for reuse',
        'Debugging and logging',
      ],
      useCases: [
        'Complex field calculations',
        'Integration transformations',
        'Custom validation logic',
        'Data synchronization scripts',
      ],
      relatedCapabilities: ['business_rules', 'integrations'],
    },

    // Integration
    {
      code: 'integrations',
      name: 'Integration Hub',
      description: 'Connect to external systems via pre-built connectors, REST APIs, and webhooks. Import and export data bidirectionally.',
      category: 'integration',
      features: [
        'Pre-built connectors (Azure AD, Okta, Jira, etc.)',
        'REST API integration',
        'Webhook support',
        'Data import/export',
        'Scheduled synchronization',
        'Field mapping',
        'Error handling and retry',
      ],
      useCases: [
        'Sync users from Active Directory',
        'Import assets from discovery tools',
        'Send incidents to external ticketing',
        'Connect to monitoring systems',
      ],
      relatedCapabilities: ['discovery', 'import_export', 'scripts'],
    },
    {
      code: 'rest_api',
      name: 'REST API',
      description: 'Full REST API for programmatic access to all platform data and operations. OAuth 2.0 and API key authentication.',
      category: 'integration',
      features: [
        'CRUD operations on all collections',
        'Query with filters and pagination',
        'Aggregate functions',
        'File uploads and downloads',
        'OAuth 2.0 and API key auth',
        'Rate limiting',
        'API documentation (Swagger)',
      ],
      useCases: [
        'Build custom integrations',
        'Create mobile apps',
        'Automate bulk operations',
        'Connect to BI tools',
      ],
      relatedCapabilities: ['integrations', 'scripts'],
    },

    // Reporting & Analytics
    {
      code: 'reports',
      name: 'Reports',
      description: 'Create and schedule reports with tables, charts, and exports. Share with users or groups.',
      category: 'reporting',
      features: [
        'Report builder',
        'Tables, charts, gauges',
        'Filters and parameters',
        'Scheduling and distribution',
        'Export to PDF, Excel, CSV',
        'Drill-down to records',
      ],
      useCases: [
        'Weekly incident summary',
        'Monthly asset inventory',
        'SLA compliance report',
        'Request volume trends',
      ],
      relatedCapabilities: ['analytics', 'dashboards', 'views'],
    },
    {
      code: 'analytics',
      name: 'Analytics Dashboard',
      description: 'Real-time analytics dashboards with KPIs, trends, and performance metrics. Drill down into data.',
      category: 'reporting',
      features: [
        'Pre-built ITSM dashboards',
        'Custom dashboard builder',
        'KPI widgets',
        'Trend charts',
        'Real-time updates',
        'Role-based dashboards',
      ],
      useCases: [
        'Monitor IT operations health',
        'Track team performance',
        'Analyze incident trends',
        'View service level metrics',
      ],
      relatedCapabilities: ['reports', 'sla_management'],
    },

    // AI Capabilities
    {
      code: 'ai_search',
      name: 'AI-Powered Search',
      description: 'Semantic search across knowledge articles, catalog items, and records using AI embeddings for natural language queries.',
      category: 'ai',
      features: [
        'Natural language queries',
        'Semantic similarity matching',
        'Cross-collection search',
        'Relevance ranking',
        'Auto-suggestions',
      ],
      useCases: [
        'Find articles about VPN issues',
        'Search for software requests',
        'Look up similar incidents',
      ],
      relatedCapabilities: ['knowledge_base', 'ava'],
    },
    {
      code: 'ava',
      name: 'AVA - AI Virtual Assistant',
      description: 'Conversational AI assistant that can answer questions, help navigate the platform, create records, and provide insights.',
      category: 'ai',
      features: [
        'Natural language chat',
        'Knowledge base Q&A',
        'Platform navigation help',
        'Record creation assistance',
        'Proactive insights',
        'Action suggestions',
        'Multi-turn conversations',
      ],
      useCases: [
        'Ask how to reset a password',
        'Create an incident through chat',
        'Get help finding a feature',
        'Ask about your open tasks',
      ],
      relatedCapabilities: ['ai_search', 'knowledge_base'],
    },

    // Security & Compliance
    {
      code: 'access_control',
      name: 'Role-Based Access Control',
      description: 'Define roles with specific permissions for collections, fields, and actions. Users inherit permissions from their roles.',
      category: 'security',
      features: [
        'Role definitions',
        'Collection-level permissions',
        'Field-level security',
        'Record-level ACLs',
        'Permission inheritance',
        'Role hierarchy',
      ],
      useCases: [
        'Restrict HR data to HR users',
        'Hide sensitive fields from certain roles',
        'Allow read-only access to reports',
      ],
      relatedCapabilities: ['sso', 'audit_log'],
    },
    {
      code: 'sso',
      name: 'Single Sign-On (SSO)',
      description: 'Integrate with enterprise identity providers using SAML 2.0 or OIDC for seamless authentication.',
      category: 'security',
      enterpriseOnly: true,
      features: [
        'SAML 2.0 support',
        'OIDC/OAuth 2.0 support',
        'Just-in-time user provisioning',
        'Role mapping from IdP',
        'Multi-factor authentication',
      ],
      useCases: [
        'Integrate with Azure AD',
        'Connect to Okta',
        'Enable MFA for all users',
      ],
      relatedCapabilities: ['access_control'],
    },
    {
      code: 'audit_log',
      name: 'Audit Trail',
      description: 'Complete audit log of all changes to records, configuration, and user actions for compliance and troubleshooting.',
      category: 'security',
      features: [
        'Record change history',
        'User action logging',
        'Login/logout tracking',
        'Configuration change audit',
        'Retention policies',
        'Audit log search',
      ],
      useCases: [
        'Track who changed a record',
        'Review login history',
        'Investigate security incidents',
        'Compliance reporting',
      ],
      relatedCapabilities: ['access_control', 'reports'],
    },

    // SLA Management
    {
      code: 'sla_management',
      name: 'SLA/OLA Management (Commitments)',
      description: 'Define service level agreements and operational level agreements with automatic tracking, alerting, and reporting.',
      category: 'itil',
      features: [
        'SLA definitions with targets',
        'Multiple SLA metrics per record',
        'Automatic SLA calculation',
        'Pause conditions (awaiting user, etc.)',
        'Breach alerts and notifications',
        'SLA reporting',
      ],
      useCases: [
        'Track incident response time SLAs',
        'Monitor request fulfillment targets',
        'Alert when SLAs are at risk',
        'Report on SLA compliance',
      ],
      relatedCapabilities: ['incident_management', 'request_fulfillment', 'notifications'],
    },

    // Notifications
    {
      code: 'notifications',
      name: 'Notifications',
      description: 'Send email and in-app notifications triggered by events, process flows, or schedules.',
      category: 'automation',
      features: [
        'Email notifications',
        'In-app notifications',
        'Notification templates',
        'Event-triggered notifications',
        'Scheduled notifications',
        'User preferences',
      ],
      useCases: [
        'Notify assignee when incident assigned',
        'Email approver for pending approvals',
        'Alert on SLA breach',
      ],
      relatedCapabilities: ['business_rules', 'process_flow_automation'],
    },

    // Import/Export
    {
      code: 'import_export',
      name: 'Import/Export',
      description: 'Import data from CSV, Excel, or external systems. Export records for offline use or data migration.',
      category: 'integration',
      features: [
        'CSV/Excel import',
        'Field mapping',
        'Validation and error handling',
        'Scheduled imports',
        'Export to CSV/Excel/JSON',
        'Bulk operations',
      ],
      useCases: [
        'Import existing asset inventory',
        'Bulk update records',
        'Export data for analysis',
        'Migrate from another system',
      ],
      relatedCapabilities: ['integrations', 'collections'],
    },

    // Portal
    {
      code: 'portal',
      name: 'Self-Service Portal',
      description: 'End-user portal for service requests, knowledge search, and ticket tracking without needing full platform access.',
      category: 'service_catalog',
      features: [
        'Service catalog browsing',
        'Request submission',
        'Request status tracking',
        'Knowledge base search',
        'Incident reporting',
        'User profile management',
      ],
      useCases: [
        'Allow employees to submit requests',
        'Let users search knowledge',
        'Enable incident reporting',
        'Track request progress',
      ],
      relatedCapabilities: ['service_catalog', 'knowledge_base', 'request_fulfillment'],
    },

    // Customization
    {
      code: 'customization_engine',
      name: 'Customization Engine',
      description: 'Extend platform configuration without modifying core code. Track customizations and manage upgrades safely.',
      category: 'customization',
      adminOnly: true,
      features: [
        'Override platform defaults',
        'Track all customizations',
        'Safe upgrade path',
        'Customization impact analysis',
        'Version comparison',
        'Rollback capability',
      ],
      useCases: [
        'Customize field labels',
        'Extend default process flows',
        'Add custom validations',
        'Modify default forms',
      ],
      relatedCapabilities: ['collections', 'forms', 'business_rules'],
    },
  ];

  /**
   * Get all platform capabilities
   */
  getCapabilities(options?: { category?: PlatformCategory; includeAdmin?: boolean; includeEnterprise?: boolean }): PlatformCapability[] {
    let filtered = [...this.capabilities];

    if (options?.category) {
      filtered = filtered.filter((c) => c.category === options.category);
    }

    if (!options?.includeAdmin) {
      filtered = filtered.filter((c) => !c.adminOnly);
    }

    if (!options?.includeEnterprise) {
      filtered = filtered.filter((c) => !c.enterpriseOnly);
    }

    return filtered;
  }

  /**
   * Get a specific capability by code
   */
  getCapability(code: string): PlatformCapability | undefined {
    return this.capabilities.find((c) => c.code === code);
  }

  /**
   * Search capabilities by keyword
   */
  searchCapabilities(query: string): PlatformCapability[] {
    const lowerQuery = query.toLowerCase();
    return this.capabilities.filter((c) =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.description.toLowerCase().includes(lowerQuery) ||
      c.features.some((f) => f.toLowerCase().includes(lowerQuery)) ||
      c.useCases.some((u) => u.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get capabilities by category
   */
  getCategories(): { code: PlatformCategory; name: string; capabilityCount: number }[] {
    const categoryNames: Record<PlatformCategory, string> = {
      core: 'Core Platform',
      itil: 'IT Service Management',
      asset_management: 'Asset Management',
      service_catalog: 'Service Catalog',
      knowledge_management: 'Knowledge Management',
      automation: 'Automation',
      integration: 'Integration',
      reporting: 'Reporting & Analytics',
      ai: 'AI & Intelligence',
      security: 'Security & Compliance',
      customization: 'Customization',
      administration: 'Administration',
    };

    const categories = Object.keys(categoryNames) as PlatformCategory[];
    return categories.map((cat) => ({
      code: cat,
      name: categoryNames[cat],
      capabilityCount: this.capabilities.filter((c) => c.category === cat).length,
    }));
  }

  /**
   * Build a capabilities summary for AVA's system prompt
   */
  buildCapabilitiesSummary(): string {
    const categories = this.getCategories();

    let summary = `\n\n## Platform Capabilities`;
    summary += `\nHubbleWave is an enterprise operations platform with the following capabilities:\n`;

    for (const cat of categories) {
      if (cat.capabilityCount === 0) continue;

      const caps = this.capabilities.filter((c) => c.category === cat.code);
      summary += `\n### ${cat.name}`;
      for (const cap of caps.slice(0, 5)) { // Limit to top 5 per category
        summary += `\n- **${cap.name}**: ${cap.description.substring(0, 100)}...`;
      }
    }

    return summary;
  }

  /**
   * Get related capabilities for a given capability
   */
  getRelatedCapabilities(code: string): PlatformCapability[] {
    const capability = this.getCapability(code);
    if (!capability) return [];

    return capability.relatedCapabilities
      .map((c) => this.getCapability(c))
      .filter((c): c is PlatformCapability => c !== undefined);
  }

  /**
   * Check if a capability is available for a user's role/instance
   */
  isCapabilityAvailable(
    code: string,
    userRole?: string,
    instanceModules?: string[]
  ): { available: boolean; reason?: string } {
    const capability = this.getCapability(code);
    if (!capability) {
      return { available: false, reason: 'Capability not found' };
    }

    if (capability.adminOnly && userRole !== 'admin') {
      return { available: false, reason: 'This feature is only available to administrators' };
    }

    if (capability.enterpriseOnly) {
      return { available: false, reason: 'This feature requires an Enterprise license' };
    }

    if (capability.module && instanceModules && !instanceModules.includes(capability.module)) {
      return { available: false, reason: `This feature requires the ${capability.module} module to be enabled` };
    }

    return { available: true };
  }
}
