/**
 * Webhooks Management Page
 * HubbleWave Platform - Phase 5
 *
 * Configure and manage webhook subscriptions.
 */

import React, { useState, useEffect } from 'react';
import {
  Webhook,
  Plus,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
import { GlassCard } from '../../components/ui/glass/GlassCard';
import { GlassButton } from '../../components/ui/glass/GlassButton';
import { GlassInput } from '../../components/ui/glass/GlassInput';
import { Badge } from '../../components/ui/Badge';

interface WebhookSubscription {
  id: string;
  name: string;
  endpointUrl: string;
  events: string[];
  isActive: boolean;
  secret?: string;
  successCount: number;
  failureCount: number;
  lastTriggeredAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  eventType: string;
  status: 'pending' | 'delivering' | 'delivered' | 'failed' | 'retrying';
  responseStatus?: number;
  durationMs?: number;
  attemptCount: number;
  createdAt: string;
}

const eventOptions = [
  { value: 'record.created', label: 'Record Created' },
  { value: 'record.updated', label: 'Record Updated' },
  { value: 'record.deleted', label: 'Record Deleted' },
  { value: 'processFlow.completed', label: 'Process Flow Completed' },
  { value: 'approval.pending', label: 'Approval Pending' },
  { value: 'approval.completed', label: 'Approval Completed' },
  { value: 'sla.breached', label: 'SLA Breached' },
];

const statusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  delivering: 'bg-info-subtle text-info-text',
  delivered: 'bg-success-subtle text-success-text',
  failed: 'bg-danger-subtle text-danger-text',
  retrying: 'bg-warning-subtle text-warning-text',
};

export const WebhooksPage: React.FC = () => {
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookSubscription | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    endpointUrl: '',
    events: [] as string[],
  });

  useEffect(() => {
    fetchWebhooks();
  }, []);

  useEffect(() => {
    if (selectedWebhook) {
      fetchDeliveries(selectedWebhook.id);
    }
  }, [selectedWebhook]);

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/webhooks');
      if (!response.ok) throw new Error('Failed to fetch webhooks');
      const data = await response.json();
      setWebhooks(data.items || []);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveries = async (webhookId: string) => {
    try {
      const response = await fetch(`/api/webhooks/${webhookId}/deliveries?limit=20`);
      if (!response.ok) throw new Error('Failed to fetch deliveries');
      const data = await response.json();
      setDeliveries(data.items || []);
    } catch (error) {
      console.error('Error fetching deliveries:', error);
    }
  };

  const createWebhook = async () => {
    try {
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error('Failed to create webhook');
      setShowCreateModal(false);
      setFormData({ name: '', endpointUrl: '', events: [] });
      fetchWebhooks();
    } catch (error) {
      console.error('Error creating webhook:', error);
    }
  };

  const toggleWebhook = async (webhook: WebhookSubscription) => {
    try {
      const endpoint = webhook.isActive ? 'deactivate' : 'activate';
      const response = await fetch(`/api/webhooks/${webhook.id}/${endpoint}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to toggle webhook');
      fetchWebhooks();
    } catch (error) {
      console.error('Error toggling webhook:', error);
    }
  };

  const testWebhook = async (webhookId: string) => {
    try {
      const response = await fetch(`/api/webhooks/${webhookId}/test`, {
        method: 'POST',
      });
      const result = await response.json();
      alert(result.success ? 'Test successful!' : `Test failed: ${result.error}`);
    } catch (error) {
      console.error('Error testing webhook:', error);
    }
  };

  const deleteWebhook = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const response = await fetch(`/api/webhooks/${webhookId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete webhook');
      if (selectedWebhook?.id === webhookId) {
        setSelectedWebhook(null);
      }
      fetchWebhooks();
    } catch (error) {
      console.error('Error deleting webhook:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const toggleEvent = (event: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-subtle rounded-lg">
            <Webhook className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Webhooks
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure real-time event notifications
            </p>
          </div>
        </div>

        <GlassButton onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Webhook
        </GlassButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Webhook List */}
        <div className="lg:col-span-1">
          <GlassCard className="p-4">
            <h2 className="text-sm font-medium text-foreground mb-4">
              Subscriptions ({webhooks.length})
            </h2>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : webhooks.length === 0 ? (
              <div className="text-center py-8">
                <Webhook className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No webhooks configured</p>
              </div>
            ) : (
              <div className="space-y-2">
                {webhooks.map((webhook) => (
                  <button
                    key={webhook.id}
                    onClick={() => setSelectedWebhook(webhook)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedWebhook?.id === webhook.id
                        ? 'bg-primary-subtle border border-primary'
                        : 'hover:bg-muted border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground truncate">
                        {webhook.name}
                      </span>
                      <Badge className={webhook.isActive ? 'bg-success-subtle text-success-text' : 'bg-muted text-muted-foreground'}>
                        {webhook.isActive ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate font-mono">
                      {webhook.endpointUrl}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="flex items-center gap-1 text-success-text">
                        <CheckCircle className="h-3 w-3" />
                        {webhook.successCount}
                      </span>
                      <span className="flex items-center gap-1 text-danger-text">
                        <XCircle className="h-3 w-3" />
                        {webhook.failureCount}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Webhook Details */}
        <div className="lg:col-span-2">
          {selectedWebhook ? (
            <div className="space-y-6">
              {/* Details Card */}
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-foreground">
                    {selectedWebhook.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <GlassButton
                      onClick={() => testWebhook(selectedWebhook.id)}
                      variant="ghost"
                      size="sm"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Test
                    </GlassButton>
                    <GlassButton
                      onClick={() => toggleWebhook(selectedWebhook)}
                      variant="ghost"
                      size="sm"
                    >
                      {selectedWebhook.isActive ? (
                        <>
                          <Pause className="h-4 w-4 mr-1" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Activate
                        </>
                      )}
                    </GlassButton>
                    <GlassButton
                      onClick={() => deleteWebhook(selectedWebhook.id)}
                      variant="danger"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </GlassButton>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Endpoint URL
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-muted rounded text-sm font-mono text-foreground">
                        {selectedWebhook.endpointUrl}
                      </code>
                      <button
                        onClick={() => copyToClipboard(selectedWebhook.endpointUrl)}
                        className="p-2 text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {selectedWebhook.secret && (
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">
                        Signing Secret
                      </label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-muted rounded text-sm font-mono text-foreground">
                          {showSecret ? selectedWebhook.secret : '••••••••••••••••'}
                        </code>
                        <button
                          onClick={() => setShowSecret(!showSecret)}
                          className="p-2 text-muted-foreground hover:text-foreground"
                        >
                          {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Events
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {selectedWebhook.events.map((event) => (
                        <Badge key={event} className="bg-primary-subtle text-primary">
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                    <div className="text-center">
                      <div className="text-2xl font-semibold text-success-text">
                        {selectedWebhook.successCount}
                      </div>
                      <div className="text-xs text-muted-foreground">Successful</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-semibold text-danger-text">
                        {selectedWebhook.failureCount}
                      </div>
                      <div className="text-xs text-muted-foreground">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-semibold text-foreground">
                        {selectedWebhook.successCount + selectedWebhook.failureCount > 0
                          ? Math.round(
                              (selectedWebhook.successCount /
                                (selectedWebhook.successCount + selectedWebhook.failureCount)) *
                                100
                            )
                          : 0}
                        %
                      </div>
                      <div className="text-xs text-muted-foreground">Success Rate</div>
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Recent Deliveries */}
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-foreground">
                    Recent Deliveries
                  </h2>
                  <GlassButton
                    onClick={() => fetchDeliveries(selectedWebhook.id)}
                    variant="ghost"
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </GlassButton>
                </div>

                {deliveries.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No deliveries yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deliveries.map((delivery) => (
                      <div
                        key={delivery.id}
                        className="flex items-center justify-between p-3 bg-muted rounded"
                      >
                        <div className="flex items-center gap-3">
                          <Badge className={statusColors[delivery.status]}>
                            {delivery.status}
                          </Badge>
                          <span className="text-sm font-medium text-foreground">
                            {delivery.eventType}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {delivery.responseStatus && (
                            <span className="font-mono">{delivery.responseStatus}</span>
                          )}
                          {delivery.durationMs && <span>{delivery.durationMs}ms</span>}
                          <span>
                            {new Date(delivery.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>
          ) : (
            <GlassCard className="p-12 text-center">
              <Webhook className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Select a Webhook
              </h3>
              <p className="text-sm text-muted-foreground">
                Choose a webhook from the list to view details and delivery history.
              </p>
            </GlassCard>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50">
          <GlassCard className="w-full max-w-md p-6">
            <h2 className="text-lg font-medium text-foreground mb-4">
              Create Webhook
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Name
                </label>
                <GlassInput
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Webhook"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Endpoint URL
                </label>
                <GlassInput
                  value={formData.endpointUrl}
                  onChange={(e) => setFormData({ ...formData, endpointUrl: e.target.value })}
                  placeholder="https://example.com/webhook"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Events
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {eventOptions.map((event) => (
                    <label
                      key={event.value}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        formData.events.includes(event.value)
                          ? 'bg-primary-subtle border border-primary'
                          : 'bg-muted border border-transparent hover:bg-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event.value)}
                        onChange={() => toggleEvent(event.value)}
                        className="sr-only"
                      />
                      <span className="text-sm text-foreground">{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <GlassButton onClick={() => setShowCreateModal(false)} variant="ghost">
                Cancel
              </GlassButton>
              <GlassButton
                onClick={createWebhook}
                disabled={!formData.name || !formData.endpointUrl || formData.events.length === 0}
              >
                Create Webhook
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default WebhooksPage;
