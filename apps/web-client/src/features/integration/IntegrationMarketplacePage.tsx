/**
 * Integration Marketplace Page
 * HubbleWave Platform - Phase 5
 *
 * Displays available connectors and their status.
 */

import { useState } from 'react';
import { GlassCard } from '../../components/ui/glass/GlassCard';

interface ConnectorDefinition {
  id: string;
  name: string;
  type: 'salesforce' | 'jira' | 'servicenow' | 'sap' | 'custom';
  description: string;
  category: 'crm' | 'project' | 'itsm' | 'erp' | 'communication';
  capabilities: string[];
  syncModes: ('realtime' | 'scheduled' | 'manual')[];
  direction: 'inbound' | 'outbound' | 'bidirectional';
  status: 'available' | 'connected' | 'coming_soon';
  logo: string;
}

const CONNECTORS: ConnectorDefinition[] = [
  {
    id: 'salesforce',
    name: 'Salesforce',
    type: 'salesforce',
    description: 'Sync customers, opportunities, and accounts between HubbleWave and Salesforce CRM',
    category: 'crm',
    capabilities: ['accounts', 'contacts', 'opportunities', 'leads', 'custom_objects'],
    syncModes: ['realtime', 'scheduled'],
    direction: 'bidirectional',
    status: 'available',
    logo: 'SF',
  },
  {
    id: 'jira',
    name: 'Jira',
    type: 'jira',
    description: 'Synchronize projects, issues, and processes with Atlassian Jira',
    category: 'project',
    capabilities: ['projects', 'issues', 'sprints', 'processes', 'comments'],
    syncModes: ['realtime', 'scheduled'],
    direction: 'bidirectional',
    status: 'available',
    logo: 'JI',
  },
  {
    id: 'servicenow',
    name: 'ServiceNow',
    type: 'servicenow',
    description: 'Integrate incidents, requests, and CMDB with ServiceNow ITSM platform',
    category: 'itsm',
    capabilities: ['incidents', 'requests', 'cmdb', 'changes', 'problems'],
    syncModes: ['scheduled', 'manual'],
    direction: 'bidirectional',
    status: 'available',
    logo: 'SN',
  },
  {
    id: 'sap',
    name: 'SAP',
    type: 'sap',
    description: 'Connect to SAP ERP for master data, purchase orders, and inventory management',
    category: 'erp',
    capabilities: ['materials', 'vendors', 'purchase_orders', 'inventory', 'work_orders'],
    syncModes: ['scheduled'],
    direction: 'inbound',
    status: 'available',
    logo: 'SAP',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'crm', label: 'CRM' },
  { id: 'project', label: 'Project Management' },
  { id: 'itsm', label: 'ITSM' },
  { id: 'erp', label: 'ERP' },
  { id: 'communication', label: 'Communication' },
];

export function IntegrationMarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredConnectors = CONNECTORS.filter((connector) => {
    const matchesSearch =
      connector.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      connector.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || connector.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getConnectorClasses = (type: string): { bgLight: string; bgSolid: string } => {
    const classes: Record<string, { bgLight: string; bgSolid: string }> = {
      salesforce: { bgLight: 'bg-info-subtle', bgSolid: 'bg-info' },
      jira: { bgLight: 'bg-info-subtle', bgSolid: 'bg-info' },
      servicenow: { bgLight: 'bg-success-subtle', bgSolid: 'bg-success' },
      sap: { bgLight: 'bg-info-subtle', bgSolid: 'bg-info' },
    };
    return classes[type] || { bgLight: 'bg-primary/10', bgSolid: 'bg-primary' };
  };

  const getDirectionLabel = (direction: string): string => {
    const labels: Record<string, string> = {
      inbound: 'One-way (Inbound)',
      outbound: 'One-way (Outbound)',
      bidirectional: 'Bi-directional',
    };
    return labels[direction] || direction;
  };

  const getSyncModeLabel = (modes: string[]): string => {
    if (modes.includes('realtime')) return 'Real-time sync';
    if (modes.includes('scheduled')) return 'Scheduled sync';
    return 'Manual sync';
  };

  return (
    <div className="integration-marketplace">
      <header className="marketplace-header">
        <h1 className="page-title">Integration Marketplace</h1>
        <p className="page-description">
          Connect HubbleWave with your favorite tools and services
        </p>
      </header>

      <div className="marketplace-filters">
        <input
          type="search"
          className="search-input"
          placeholder="Search integrations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className="filter-chips">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              className={`chip ${selectedCategory === category.id ? 'chip--active' : ''}`}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <div className="integrations-grid">
        {filteredConnectors.map((connector) => (
          <GlassCard key={connector.id} className="integration-card">
            <div
              className={`integration-card__header ${getConnectorClasses(connector.type).bgLight}`}
            >
              <div
                className={`integration-card__logo ${getConnectorClasses(connector.type).bgSolid} text-primary-foreground`}
              >
                {connector.logo}
              </div>
              {connector.status === 'connected' && (
                <span className="badge badge--success">Connected</span>
              )}
            </div>

            <div className="integration-card__body">
              <h3 className="integration-card__name">{connector.name}</h3>
              <p className="integration-card__description">{connector.description}</p>

              <div className="integration-card__meta">
                <span className="meta-item">{getSyncModeLabel(connector.syncModes)}</span>
                <span className="meta-item">{getDirectionLabel(connector.direction)}</span>
              </div>

              <div className="integration-card__capabilities">
                {connector.capabilities.slice(0, 3).map((cap) => (
                  <span key={cap} className="capability-badge">
                    {cap.replace(/_/g, ' ')}
                  </span>
                ))}
                {connector.capabilities.length > 3 && (
                  <span className="capability-badge capability-badge--more">
                    +{connector.capabilities.length - 3}
                  </span>
                )}
              </div>
            </div>

            <div className="integration-card__footer">
              {connector.status === 'connected' ? (
                <button className="button button--secondary button--block">Configure</button>
              ) : connector.status === 'coming_soon' ? (
                <button className="button button--disabled button--block" disabled>
                  Coming Soon
                </button>
              ) : (
                <button className="button button--primary button--block">Connect</button>
              )}
            </div>
          </GlassCard>
        ))}
      </div>

      <style>{`
        .integration-marketplace {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .marketplace-header {
          margin-bottom: 2rem;
          text-align: center;
        }

        .page-title {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
        }

        .page-description {
          color: var(--text-secondary);
          font-size: 1.125rem;
        }

        .marketplace-filters {
          margin-bottom: 2rem;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid var(--border-default);
          border-radius: 8px;
          font-size: 1rem;
          background: var(--bg-surface);
          color: var(--text-primary);
          margin-bottom: 1rem;
        }

        .filter-chips {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .chip {
          padding: 0.5rem 1rem;
          border: 1px solid var(--border-default);
          border-radius: 999px;
          background: var(--bg-surface);
          color: var(--text-secondary);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .chip:hover {
          background: var(--bg-hover);
        }

        .chip--active {
          background: var(--gradient-brand);
          color: var(--text-on-primary);
          border-color: var(--border-primary);
        }

        .integrations-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
        }

        .integration-card {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .integration-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem;
        }

        .integration-card__logo {
          width: 64px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          font-size: 1.25rem;
          font-weight: 700;
        }

        .integration-card__body {
          flex: 1;
          padding: 1.5rem;
          padding-top: 0;
        }

        .integration-card__name {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .integration-card__description {
          color: var(--text-secondary);
          font-size: 0.875rem;
          line-height: 1.5;
          margin-bottom: 1rem;
        }

        .integration-card__meta {
          display: flex;
          gap: 1rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-bottom: 1rem;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .integration-card__capabilities {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }

        .capability-badge {
          padding: 0.25rem 0.5rem;
          background: var(--bg-surface-secondary);
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 4px;
          font-size: 0.75rem;
          text-transform: capitalize;
        }

        .capability-badge--more {
          background: var(--bg-primary);
          color: var(--text-on-primary);
          border-color: transparent;
        }

        .integration-card__footer {
          padding: 1rem 1.5rem;
          background: var(--bg-surface-secondary);
          border-top: 1px solid var(--border-subtle);
        }

        .badge {
          padding: 0.25rem 0.75rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .badge--success {
          background: var(--bg-success-subtle);
          color: var(--text-success);
        }

        .button {
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          border: none;
        }

        .button--block {
          width: 100%;
        }

        .button--primary {
          background: var(--gradient-brand);
          color: var(--text-on-primary);
          box-shadow: var(--shadow-primary);
        }

        .button--primary:hover {
          background: var(--gradient-brand-hover);
        }

        .button--secondary {
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          color: var(--text-secondary);
        }

        .button--secondary:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .button--disabled {
          background: var(--bg-surface);
          color: var(--text-muted);
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
