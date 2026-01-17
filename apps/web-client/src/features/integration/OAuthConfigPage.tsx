/**
 * OAuth Configuration Page
 * HubbleWave Platform - Phase 5
 *
 * Manage OAuth2 clients and API keys.
 */

import { useState } from 'react';
import { GlassCard } from '../../components/ui/glass/GlassCard';

interface OAuthClient {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  grants: string[];
  scopes: string[];
  accessTokenLifetime: number;
  refreshTokenLifetime: number;
  active: boolean;
  createdAt: Date;
  lastUsed: Date | null;
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revoked: boolean;
  createdAt: Date;
}

const MOCK_OAUTH_CLIENTS: OAuthClient[] = [
  {
    id: 'client-1',
    name: 'Mobile App',
    clientId: 'hw_mobile_app_123',
    clientSecret: 'secret_xxxxxxxxxxxxxxxxxx',
    redirectUris: ['hubblewave://callback', 'https://app.hubblewave.com/callback'],
    grants: ['authorization_code', 'refresh_token'],
    scopes: ['read', 'write'],
    accessTokenLifetime: 3600,
    refreshTokenLifetime: 2592000,
    active: true,
    createdAt: new Date('2025-01-01'),
    lastUsed: new Date(),
  },
  {
    id: 'client-2',
    name: 'Third-Party Integration',
    clientId: 'hw_integration_456',
    clientSecret: 'secret_yyyyyyyyyyyyyyyy',
    redirectUris: ['https://partner.example.com/oauth/callback'],
    grants: ['client_credentials'],
    scopes: ['read'],
    accessTokenLifetime: 7200,
    refreshTokenLifetime: 0,
    active: true,
    createdAt: new Date('2025-01-10'),
    lastUsed: new Date(Date.now() - 86400000),
  },
];

const MOCK_API_KEYS: ApiKey[] = [
  {
    id: 'key-1',
    name: 'Production API Key',
    keyPrefix: 'hw_live_',
    scopes: ['read', 'write', 'admin'],
    rateLimit: 10000,
    expiresAt: null,
    lastUsedAt: new Date(),
    revoked: false,
    createdAt: new Date('2025-01-01'),
  },
  {
    id: 'key-2',
    name: 'Development API Key',
    keyPrefix: 'hw_test_',
    scopes: ['read', 'write'],
    rateLimit: 1000,
    expiresAt: new Date('2025-12-31'),
    lastUsedAt: new Date(Date.now() - 3600000),
    revoked: false,
    createdAt: new Date('2025-01-15'),
  },
];

export function OAuthConfigPage() {
  const [activeTab, setActiveTab] = useState<'oauth' | 'api-keys'>('oauth');
  const [, setShowClientModal] = useState(false);
  const [, setShowKeyModal] = useState(false);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatRelativeTime = (date: Date): string => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const renderOAuthClients = () => (
    <div className="oauth-clients">
      <div className="section-header">
        <div>
          <h2>OAuth2 Clients</h2>
          <p>Manage OAuth2 applications that can access HubbleWave APIs</p>
        </div>
        <button className="button button--primary" onClick={() => setShowClientModal(true)}>
          + New OAuth Client
        </button>
      </div>

      <div className="clients-list">
        {MOCK_OAUTH_CLIENTS.map((client) => (
          <GlassCard key={client.id} className="client-card">
            <div className="client-header">
              <div className="client-info">
                <h3>{client.name}</h3>
                <code className="client-id">{client.clientId}</code>
              </div>
              <span className={`status-badge ${client.active ? 'status-badge--active' : 'status-badge--inactive'}`}>
                {client.active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="client-details">
              <div className="detail-row">
                <span className="detail-label">Grants</span>
                <div className="grants-list">
                  {client.grants.map((grant) => (
                    <span key={grant} className="grant-badge">
                      {grant.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              <div className="detail-row">
                <span className="detail-label">Scopes</span>
                <div className="scopes-list">
                  {client.scopes.map((scope) => (
                    <span key={scope} className="scope-badge">
                      {scope}
                    </span>
                  ))}
                </div>
              </div>

              <div className="detail-row">
                <span className="detail-label">Redirect URIs</span>
                <div className="uris-list">
                  {client.redirectUris.map((uri, i) => (
                    <code key={i} className="uri">
                      {uri}
                    </code>
                  ))}
                </div>
              </div>

              <div className="detail-row">
                <span className="detail-label">Token Lifetime</span>
                <span>Access: {client.accessTokenLifetime / 60}min, Refresh: {client.refreshTokenLifetime / 86400}d</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Last Used</span>
                <span>{client.lastUsed ? formatRelativeTime(client.lastUsed) : 'Never'}</span>
              </div>
            </div>

            <div className="client-actions">
              <button className="button button--secondary button--sm">Edit</button>
              <button className="button button--secondary button--sm">Rotate Secret</button>
              <button className="button button--ghost button--sm">Revoke</button>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );

  const renderApiKeys = () => (
    <div className="api-keys">
      <div className="section-header">
        <div>
          <h2>API Keys</h2>
          <p>Generate and manage API keys for direct API access</p>
        </div>
        <button className="button button--primary" onClick={() => setShowKeyModal(true)}>
          + New API Key
        </button>
      </div>

      <div className="keys-list">
        {MOCK_API_KEYS.map((key) => (
          <GlassCard key={key.id} className="key-card">
            <div className="key-header">
              <div className="key-info">
                <h3>{key.name}</h3>
                <code className="key-preview">{key.keyPrefix}••••••••••••••••</code>
              </div>
              <span className={`status-badge ${key.revoked ? 'status-badge--inactive' : 'status-badge--active'}`}>
                {key.revoked ? 'Revoked' : 'Active'}
              </span>
            </div>

            <div className="key-details">
              <div className="key-stats">
                <div className="key-stat">
                  <span className="stat-label">Scopes</span>
                  <div className="scopes-list">
                    {key.scopes.map((scope) => (
                      <span key={scope} className="scope-badge">
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="key-stat">
                  <span className="stat-label">Rate Limit</span>
                  <span className="stat-value">{key.rateLimit.toLocaleString()}/min</span>
                </div>

                <div className="key-stat">
                  <span className="stat-label">Expires</span>
                  <span className="stat-value">
                    {key.expiresAt ? formatDate(key.expiresAt) : 'Never'}
                  </span>
                </div>

                <div className="key-stat">
                  <span className="stat-label">Last Used</span>
                  <span className="stat-value">
                    {key.lastUsedAt ? formatRelativeTime(key.lastUsedAt) : 'Never'}
                  </span>
                </div>

                <div className="key-stat">
                  <span className="stat-label">Created</span>
                  <span className="stat-value">{formatDate(key.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="key-actions">
              <button className="button button--secondary button--sm">Edit</button>
              <button className="button button--ghost button--sm button--danger">Revoke</button>
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="security-tips">
        <h3>Security Best Practices</h3>
        <ul>
          <li>Never share API keys in public repositories or client-side code</li>
          <li>Use the minimum required scopes for each key</li>
          <li>Rotate keys regularly and revoke unused keys</li>
          <li>Set expiration dates for temporary access</li>
          <li>Monitor API key usage for suspicious activity</li>
        </ul>
      </GlassCard>
    </div>
  );

  return (
    <div className="oauth-config-page">
      <header className="page-header">
        <h1 className="page-title">Authentication & API Access</h1>
        <p className="page-description">Manage OAuth2 clients and API keys for secure API access</p>
      </header>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'oauth' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('oauth')}
        >
          OAuth2 Clients
        </button>
        <button
          className={`tab ${activeTab === 'api-keys' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('api-keys')}
        >
          API Keys
        </button>
      </div>

      {activeTab === 'oauth' ? renderOAuthClients() : renderApiKeys()}

      <style>{`
        .oauth-config-page {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 2rem;
        }

        .page-title {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
        }

        .page-description {
          color: var(--text-secondary);
        }

        .tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 2rem;
          border-bottom: 1px solid var(--border-color);
        }

        .tab {
          padding: 1rem 1.5rem;
          border: none;
          background: transparent;
          font-size: 1rem;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: all 0.15s ease;
        }

        .tab--active {
          border-bottom-color: var(--primary);
          color: var(--primary);
          font-weight: 500;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .section-header h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .section-header p {
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        .clients-list, .keys-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .client-card, .key-card {
          padding: 1.5rem;
        }

        .client-header, .key-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
        }

        .client-info h3, .key-info h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .client-id, .key-preview {
          font-size: 0.875rem;
          color: var(--text-secondary);
          background: var(--surface-elevated);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }

        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .status-badge--active {
          background: var(--bg-success-subtle);
          color: var(--text-success);
        }

        .status-badge--inactive {
          background: var(--bg-surface-secondary);
          color: var(--text-muted);
        }

        .client-details, .key-details {
          margin-bottom: 1.5rem;
        }

        .detail-row {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--border-color);
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-label {
          width: 120px;
          font-size: 0.875rem;
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        .grants-list, .scopes-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }

        .grant-badge {
          padding: 0.25rem 0.5rem;
          background: var(--surface-elevated);
          border-radius: 4px;
          font-size: 0.75rem;
          text-transform: capitalize;
        }

        .scope-badge {
          padding: 0.25rem 0.5rem;
          background: var(--primary-light);
          color: var(--primary);
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .uris-list {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .uri {
          font-size: 0.75rem;
          color: var(--text-secondary);
          background: var(--surface-elevated);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }

        .client-actions, .key-actions {
          display: flex;
          gap: 0.5rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
        }

        .key-stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 1rem;
        }

        .key-stat {
          text-align: center;
          padding: 0.75rem;
          background: var(--surface-elevated);
          border-radius: 6px;
        }

        .stat-label {
          display: block;
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-bottom: 0.25rem;
        }

        .stat-value {
          font-weight: 500;
        }

        .security-tips {
          margin-top: 2rem;
          padding: 1.5rem;
        }

        .security-tips h3 {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }

        .security-tips ul {
          margin: 0;
          padding-left: 1.5rem;
        }

        .security-tips li {
          margin-bottom: 0.5rem;
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        .button {
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: all 0.15s ease;
        }

        .button--sm {
          padding: 0.5rem 1rem;
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
          background: var(--surface-elevated);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
        }

        .button--secondary:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .button--ghost {
          background: transparent;
          color: var(--text-secondary);
        }

        .button--danger {
          color: var(--text-danger);
        }

        .button--danger:hover {
          background: var(--bg-danger-subtle);
        }
      `}</style>
    </div>
  );
}
