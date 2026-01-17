/**
 * API Explorer Page
 * HubbleWave Platform - Phase 5
 *
 * Interactive API documentation and testing interface.
 */

import React, { useState, useEffect } from 'react';
import {
  Key,
  Code,
  Play,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  Search,
  ExternalLink,
  RefreshCw,
  Lock,
  Plus,
} from 'lucide-react';
import { GlassCard } from '../../components/ui/glass/GlassCard';
import { GlassButton } from '../../components/ui/glass/GlassButton';
import { GlassInput } from '../../components/ui/glass/GlassInput';
import { GlassModal } from '../../components/ui/glass/GlassModal';
import { Badge } from '../../components/ui/Badge';
import { getStoredToken } from '../../services/token';

interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  parameters?: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: Record<string, ApiResponse>;
  security?: string[];
}

interface ApiParameter {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  type: string;
  description?: string;
}

interface ApiRequestBody {
  contentType: string;
  schema: Record<string, unknown>;
  example?: unknown;
}

interface ApiResponse {
  description: string;
  schema?: Record<string, unknown>;
  example?: unknown;
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
}

const methodColors: Record<string, string> = {
  GET: 'bg-success-subtle text-success-text',
  POST: 'bg-info-subtle text-info-text',
  PUT: 'bg-warning-subtle text-warning-text',
  PATCH: 'bg-warning-subtle text-warning-text',
  DELETE: 'bg-danger-subtle text-danger-text',
};

export const ApiExplorerPage: React.FC = () => {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'endpoints' | 'keys'>('endpoints');
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [testResponse, setTestResponse] = useState<string>('');
  const [testLoading, setTestLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [createdKeySecret, setCreatedKeySecret] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    fetchEndpoints();
    fetchApiKeys();
  }, []);

  const fetchEndpoints = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/openapi/spec');
      if (!response.ok) throw new Error('Failed to fetch API spec');
      const spec = await response.json();

      const parsedEndpoints: ApiEndpoint[] = [];
      Object.entries(spec.paths || {}).forEach(([path, methods]) => {
        Object.entries(methods as Record<string, unknown>).forEach(([method, details]) => {
          const endpointDetails = details as Record<string, unknown>;
          parsedEndpoints.push({
            id: `${method.toUpperCase()}-${path}`,
            method: method.toUpperCase() as ApiEndpoint['method'],
            path,
            summary: endpointDetails.summary as string || '',
            description: endpointDetails.description as string,
            tags: (endpointDetails.tags as string[]) || ['General'],
            parameters: endpointDetails.parameters as ApiParameter[],
            requestBody: endpointDetails.requestBody as ApiRequestBody,
            responses: endpointDetails.responses as Record<string, ApiResponse>,
            security: endpointDetails.security as string[],
          });
        });
      });

      setEndpoints(parsedEndpoints);
    } catch (error) {
      console.error('Error fetching API spec:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const token = getStoredToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch('/api/api-keys', { headers });
      if (!response.ok) throw new Error('Failed to fetch API keys');
      const data = await response.json();
      setApiKeys(data.items || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
    }
  };

  const toggleTag = (tag: string) => {
    setExpandedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const filteredEndpoints = endpoints.filter(
    ep =>
      ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedEndpoints = filteredEndpoints.reduce((acc, ep) => {
    const tag = ep.tags[0] || 'General';
    if (!acc[tag]) acc[tag] = [];
    acc[tag].push(ep);
    return acc;
  }, {} as Record<string, ApiEndpoint[]>);

  const testEndpoint = async () => {
    if (!selectedEndpoint) return;

    setTestLoading(true);
    setTestResponse('');

    try {
      const response = await fetch(`/api${selectedEndpoint.path}`, {
        method: selectedEndpoint.method,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      setTestResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      const err = error as Error;
      setTestResponse(`Error: ${err.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenCreateModal = () => {
    setNewKeyName('');
    setNewKeyDescription('');
    setCreatedKeySecret(null);
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setNewKeyName('');
    setNewKeyDescription('');
    setCreatedKeySecret(null);
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) return;

    setCreateLoading(true);
    try {
      const token = getStoredToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: newKeyName.trim(),
          description: newKeyDescription.trim() || undefined,
          scopes: [{ name: 'read', description: 'Read access', resources: ['*'], actions: ['read'] }],
        }),
      });
      if (!response.ok) throw new Error('Failed to create API key');

      const data = await response.json();
      setCreatedKeySecret(data.secret || data.key || null);
      fetchApiKeys();
    } catch (error) {
      console.error('Error creating API key:', error);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-subtle rounded-lg">
            <Code className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              API Explorer
            </h1>
            <p className="text-sm text-muted-foreground">
              Explore and test the HubbleWave API
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <GlassButton onClick={fetchEndpoints} variant="ghost" size="sm">
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </GlassButton>
          <GlassButton onClick={() => window.open('/api/docs', '_blank')} variant="ghost" size="sm">
            <ExternalLink className="h-4 w-4 mr-1" />
            Full Docs
          </GlassButton>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab('endpoints')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'endpoints'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Code className="h-4 w-4 inline-block mr-1" />
          Endpoints
        </button>
        <button
          onClick={() => setActiveTab('keys')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'keys'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Key className="h-4 w-4 inline-block mr-1" />
          API Keys
        </button>
      </div>

      {activeTab === 'endpoints' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Endpoint List */}
          <div className="lg:col-span-1">
            <GlassCard className="p-4">
              <div className="mb-4">
                <GlassInput
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search endpoints..."
                  leftAddon={<Search className="h-4 w-4" />}
                />
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(groupedEndpoints).map(([tag, tagEndpoints]) => (
                    <div key={tag}>
                      <button
                        onClick={() => toggleTag(tag)}
                        className="w-full flex items-center justify-between p-2 text-sm font-medium text-foreground hover:bg-muted rounded"
                      >
                        <span>{tag}</span>
                        {expandedTags.has(tag) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      {expandedTags.has(tag) && (
                        <div className="ml-2 space-y-1">
                          {tagEndpoints.map((endpoint) => (
                            <button
                              key={endpoint.id}
                              onClick={() => setSelectedEndpoint(endpoint)}
                              className={`w-full flex items-center gap-2 p-2 text-left rounded transition-colors ${
                                selectedEndpoint?.id === endpoint.id
                                  ? 'bg-primary-subtle'
                                  : 'hover:bg-muted'
                              }`}
                            >
                              <Badge className={`${methodColors[endpoint.method]} text-xs font-mono`}>
                                {endpoint.method}
                              </Badge>
                              <span className="text-sm text-muted-foreground truncate font-mono">
                                {endpoint.path}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          {/* Endpoint Details */}
          <div className="lg:col-span-2">
            {selectedEndpoint ? (
              <GlassCard className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Badge className={`${methodColors[selectedEndpoint.method]} text-sm font-mono`}>
                    {selectedEndpoint.method}
                  </Badge>
                  <code className="text-lg font-mono text-foreground">
                    {selectedEndpoint.path}
                  </code>
                  {selectedEndpoint.security && (
                    <Lock className="h-4 w-4 text-warning-text" />
                  )}
                </div>

                <p className="text-muted-foreground mb-4">
                  {selectedEndpoint.summary}
                </p>

                {selectedEndpoint.description && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {selectedEndpoint.description}
                  </p>
                )}

                {/* Parameters */}
                {selectedEndpoint.parameters && selectedEndpoint.parameters.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-foreground mb-2">
                      Parameters
                    </h3>
                    <div className="space-y-2">
                      {selectedEndpoint.parameters.map((param) => (
                        <div
                          key={param.name}
                          className="flex items-center gap-2 p-2 bg-muted rounded"
                        >
                          <code className="text-sm font-mono text-foreground">
                            {param.name}
                          </code>
                          <Badge className="text-xs">{param.in}</Badge>
                          <span className="text-xs text-muted-foreground">{param.type}</span>
                          {param.required && (
                            <Badge className="bg-danger-subtle text-danger-text text-xs">required</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Try It */}
                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-foreground">
                      Try It
                    </h3>
                    <GlassButton onClick={testEndpoint} disabled={testLoading} size="sm">
                      {testLoading ? (
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-1" />
                      )}
                      Send Request
                    </GlassButton>
                  </div>

                  {testResponse && (
                    <div className="relative">
                      <pre className="p-4 bg-muted text-foreground rounded-lg text-sm overflow-x-auto">
                        {testResponse}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(testResponse)}
                        className="absolute top-2 right-2 p-1 bg-card rounded hover:bg-muted"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-success-text" />
                        ) : (
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </GlassCard>
            ) : (
              <GlassCard className="p-12 text-center">
                <Code className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Select an Endpoint
                </h3>
                <p className="text-sm text-muted-foreground">
                  Choose an endpoint from the list to view details and test it.
                </p>
              </GlassCard>
            )}
          </div>
        </div>
      ) : (
        <div>
          {/* API Keys Management */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-foreground">
              Your API Keys
            </h2>
            <GlassButton onClick={handleOpenCreateModal} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Create API Key
            </GlassButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {apiKeys.map((key) => (
              <GlassCard key={key.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-foreground">
                      {key.name}
                    </h3>
                    <code className="text-sm text-muted-foreground font-mono">
                      {key.keyPrefix}...
                    </code>
                  </div>
                  <Badge className={key.isActive ? 'bg-success-subtle text-success-text' : 'bg-danger-subtle text-danger-text'}>
                    {key.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {key.scopes.map((scope, idx) => (
                    <Badge key={idx} className="text-xs bg-muted text-muted-foreground">
                      {scope}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                  {key.lastUsedAt && (
                    <span>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </GlassCard>
            ))}

            {apiKeys.length === 0 && (
              <GlassCard className="p-12 text-center col-span-2">
                <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No API Keys
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create an API key to access the HubbleWave API programmatically.
                </p>
                <GlassButton onClick={handleOpenCreateModal}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Your First Key
                </GlassButton>
              </GlassCard>
            )}
          </div>
        </div>
      )}

      {/* Create API Key Modal */}
      <GlassModal
        open={showCreateModal}
        onClose={handleCloseCreateModal}
        title={createdKeySecret ? 'API Key Created' : 'Create API Key'}
      >
        <div className="p-4">
          {createdKeySecret ? (
            <div className="space-y-4">
              <div className="p-4 bg-success-subtle rounded-lg border border-success-border">
                <p className="text-sm text-success-text mb-2">
                  Your API key has been created. Copy it now - you won&apos;t be able to see it again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted text-success-text rounded font-mono text-sm break-all">
                    {createdKeySecret}
                  </code>
                  <button
                    onClick={() => copyToClipboard(createdKeySecret)}
                    className="p-2 bg-card rounded hover:bg-muted"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-success-text" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <GlassButton onClick={handleCloseCreateModal}>
                  Done
                </GlassButton>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Key Name <span className="text-danger-text">*</span>
                </label>
                <GlassInput
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production API Key"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Description
                </label>
                <GlassInput
                  value={newKeyDescription}
                  onChange={(e) => setNewKeyDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <GlassButton variant="ghost" onClick={handleCloseCreateModal}>
                  Cancel
                </GlassButton>
                <GlassButton
                  onClick={createApiKey}
                  disabled={!newKeyName.trim() || createLoading}
                >
                  {createLoading ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Key className="h-4 w-4 mr-1" />
                  )}
                  Create Key
                </GlassButton>
              </div>
            </div>
          )}
        </div>
      </GlassModal>
    </div>
  );
};

export default ApiExplorerPage;
