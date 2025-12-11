import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save,
  ArrowLeft,
  Settings,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
  Mail,
  Bell,
  Smartphone,
  Globe,
  Eye,
} from 'lucide-react';

type ChannelType = 'email' | 'in_app' | 'sms' | 'push' | 'webhook';

interface NotificationTemplate {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  eventCode: string;
  channels: ChannelType[];
  templates: {
    email?: {
      subject: string;
      body: string;
      isHtml: boolean;
    };
    in_app?: {
      title: string;
      body: string;
      icon?: string;
      actionUrl?: string;
    };
    sms?: {
      body: string;
    };
    push?: {
      title: string;
      body: string;
      icon?: string;
      actionUrl?: string;
    };
    webhook?: {
      url: string;
      method: 'GET' | 'POST' | 'PUT';
      headers: Record<string, string>;
      bodyTemplate: string;
    };
  };
  recipientConfig: {
    type: 'user' | 'role' | 'group' | 'dynamic' | 'field';
    value: string;
    additionalRecipients?: string[];
  };
  conditionExpression?: Record<string, any>;
  throttleMinutes?: number;
  isActive: boolean;
  source: 'platform' | 'tenant';
}

const mockTemplate: NotificationTemplate = {
  id: '1',
  code: 'wo_assigned',
  name: 'Work Order Assigned',
  description: 'Notification sent when a work order is assigned to a technician',
  category: 'work_order',
  eventCode: 'work_order.assigned',
  channels: ['email', 'in_app', 'push'],
  templates: {
    email: {
      subject: 'Work Order Assigned: {{workOrder.number}}',
      body: `<p>Hello {{assignee.firstName}},</p>
<p>A new work order has been assigned to you:</p>
<ul>
  <li><strong>WO Number:</strong> {{workOrder.number}}</li>
  <li><strong>Description:</strong> {{workOrder.description}}</li>
  <li><strong>Priority:</strong> {{workOrder.priority}}</li>
  <li><strong>Due Date:</strong> {{workOrder.dueDate | date}}</li>
</ul>
<p><a href="{{appUrl}}/work-orders/{{workOrder.id}}">View Work Order</a></p>`,
      isHtml: true,
    },
    in_app: {
      title: 'Work Order Assigned',
      body: 'Work order {{workOrder.number}} has been assigned to you',
      icon: 'clipboard',
      actionUrl: '/work-orders/{{workOrder.id}}',
    },
    push: {
      title: 'New Work Order',
      body: '{{workOrder.number}}: {{workOrder.description}}',
      actionUrl: '/work-orders/{{workOrder.id}}',
    },
  },
  recipientConfig: {
    type: 'field',
    value: 'assigneeId',
  },
  throttleMinutes: 0,
  isActive: true,
  source: 'platform',
};

const channelIcons: Record<ChannelType, React.FC<{ className?: string }>> = {
  email: Mail,
  in_app: Bell,
  sms: Smartphone,
  push: Smartphone,
  webhook: Globe,
};

const channelLabels: Record<ChannelType, string> = {
  email: 'Email',
  in_app: 'In-App',
  sms: 'SMS',
  push: 'Push',
  webhook: 'Webhook',
};

export const NotificationEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [template, setTemplate] = useState<NotificationTemplate>(
    isNew
      ? {
          id: '',
          code: '',
          name: '',
          description: '',
          category: 'general',
          eventCode: '',
          channels: ['email'],
          templates: {
            email: {
              subject: '',
              body: '',
              isHtml: true,
            },
          },
          recipientConfig: {
            type: 'user',
            value: '',
          },
          isActive: true,
          source: 'tenant',
        }
      : mockTemplate
  );

  const [activeChannel, setActiveChannel] = useState<ChannelType>('email');
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleChange = (field: keyof NotificationTemplate, value: any) => {
    setTemplate((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleChannelToggle = (channel: ChannelType) => {
    const hasChannel = template.channels.includes(channel);
    if (hasChannel) {
      handleChange(
        'channels',
        template.channels.filter((c) => c !== channel)
      );
      // Remove template for this channel
      const newTemplates = { ...template.templates };
      delete newTemplates[channel];
      handleChange('templates', newTemplates);
    } else {
      handleChange('channels', [...template.channels, channel]);
      // Add default template for this channel
      const defaultTemplates: Record<ChannelType, any> = {
        email: { subject: '', body: '', isHtml: true },
        in_app: { title: '', body: '' },
        sms: { body: '' },
        push: { title: '', body: '' },
        webhook: { url: '', method: 'POST', headers: {}, bodyTemplate: '{}' },
      };
      handleChange('templates', {
        ...template.templates,
        [channel]: defaultTemplates[channel],
      });
    }
  };

  const handleTemplateChange = (channel: ChannelType, field: string, value: any) => {
    setTemplate((prev) => ({
      ...prev,
      templates: {
        ...prev.templates,
        [channel]: {
          ...(prev.templates[channel] as any),
          [field]: value,
        },
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    setHasChanges(false);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this notification template?')) {
      navigate('/studio/notifications');
    }
  };

  const renderTemplateEditor = () => {
    const channelTemplate = template.templates[activeChannel];
    if (!channelTemplate) return null;

    const isReadOnly = template.source === 'platform';

    switch (activeChannel) {
      case 'email':
        const emailTemplate = channelTemplate as { subject: string; body: string; isHtml: boolean };
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                value={emailTemplate.subject}
                onChange={(e) => handleTemplateChange('email', 'subject', e.target.value)}
                disabled={isReadOnly}
                placeholder="e.g., Work Order Assigned: {{workOrder.number}}"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">Body</label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={emailTemplate.isHtml}
                    onChange={(e) => handleTemplateChange('email', 'isHtml', e.target.checked)}
                    disabled={isReadOnly}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  HTML
                </label>
              </div>
              <textarea
                value={emailTemplate.body}
                onChange={(e) => handleTemplateChange('email', 'body', e.target.value)}
                disabled={isReadOnly}
                rows={12}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
              />
            </div>
          </div>
        );

      case 'in_app':
      case 'push':
        const appTemplate = channelTemplate as {
          title: string;
          body: string;
          icon?: string;
          actionUrl?: string;
        };
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={appTemplate.title}
                onChange={(e) => handleTemplateChange(activeChannel, 'title', e.target.value)}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Body</label>
              <textarea
                value={appTemplate.body}
                onChange={(e) => handleTemplateChange(activeChannel, 'body', e.target.value)}
                disabled={isReadOnly}
                rows={4}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Action URL (optional)
              </label>
              <input
                type="text"
                value={appTemplate.actionUrl || ''}
                onChange={(e) => handleTemplateChange(activeChannel, 'actionUrl', e.target.value)}
                disabled={isReadOnly}
                placeholder="e.g., /work-orders/{{workOrder.id}}"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
              />
            </div>
            {activeChannel === 'in_app' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Icon (optional)
                </label>
                <input
                  type="text"
                  value={appTemplate.icon || ''}
                  onChange={(e) => handleTemplateChange(activeChannel, 'icon', e.target.value)}
                  disabled={isReadOnly}
                  placeholder="e.g., clipboard, alert, check"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>
            )}
          </div>
        );

      case 'sms':
        const smsTemplate = channelTemplate as { body: string };
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Message (max 160 chars)
              </label>
              <textarea
                value={smsTemplate.body}
                onChange={(e) => handleTemplateChange('sms', 'body', e.target.value)}
                disabled={isReadOnly}
                rows={4}
                maxLength={160}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
              />
              <p className="text-xs text-slate-500 mt-1">
                {smsTemplate.body.length}/160 characters
              </p>
            </div>
          </div>
        );

      case 'webhook':
        const webhookTemplate = channelTemplate as {
          url: string;
          method: 'GET' | 'POST' | 'PUT';
          headers: Record<string, string>;
          bodyTemplate: string;
        };
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
                <select
                  value={webhookTemplate.method}
                  onChange={(e) =>
                    handleTemplateChange('webhook', 'method', e.target.value)
                  }
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>
              <div className="col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">URL</label>
                <input
                  type="text"
                  value={webhookTemplate.url}
                  onChange={(e) => handleTemplateChange('webhook', 'url', e.target.value)}
                  disabled={isReadOnly}
                  placeholder="https://api.example.com/webhook"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Headers (JSON)
              </label>
              <textarea
                value={JSON.stringify(webhookTemplate.headers, null, 2)}
                onChange={(e) => {
                  try {
                    const headers = JSON.parse(e.target.value);
                    handleTemplateChange('webhook', 'headers', headers);
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                disabled={isReadOnly}
                rows={4}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Body Template</label>
              <textarea
                value={webhookTemplate.bodyTemplate}
                onChange={(e) => handleTemplateChange('webhook', 'bodyTemplate', e.target.value)}
                disabled={isReadOnly}
                rows={8}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/studio/notifications')}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-900">
                  {isNew ? 'New Notification Template' : template.name}
                </h1>
                {template.source === 'platform' && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                    Platform
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">
                {template.code || 'Configure notification channels and templates'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>

            <button
              onClick={() => handleChange('isActive', !template.isActive)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                template.isActive
                  ? 'text-green-600 bg-green-50 hover:bg-green-100'
                  : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {template.isActive ? (
                <ToggleRight className="h-4 w-4" />
              ) : (
                <ToggleLeft className="h-4 w-4" />
              )}
              {template.isActive ? 'Active' : 'Inactive'}
            </button>

            {!isNew && template.source !== 'platform' && (
              <button
                onClick={handleDelete}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={!hasChanges || saving || template.source === 'platform'}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Channel Selection */}
        <div className="w-64 flex-shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto">
          <div className="p-4">
            <h2 className="font-medium text-slate-900 mb-4">Channels</h2>

            <div className="space-y-2">
              {(Object.keys(channelLabels) as ChannelType[]).map((channel) => {
                const Icon = channelIcons[channel];
                const isEnabled = template.channels.includes(channel);
                return (
                  <div
                    key={channel}
                    className={`rounded-lg border transition-colors ${
                      isEnabled ? 'border-slate-200 bg-white' : 'border-transparent'
                    }`}
                  >
                    <label className="flex items-center gap-3 p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleChannelToggle(channel)}
                        disabled={template.source === 'platform'}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      <Icon className="h-4 w-4 text-slate-500" />
                      <span className="text-sm text-slate-700">{channelLabels[channel]}</span>
                    </label>
                    {isEnabled && (
                      <button
                        onClick={() => setActiveChannel(channel)}
                        className={`w-full text-left px-3 py-2 text-sm border-t border-slate-100 transition-colors ${
                          activeChannel === channel
                            ? 'bg-primary-50 text-primary-600'
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        Edit Template
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Template Editor */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              {React.createElement(channelIcons[activeChannel], {
                className: 'h-5 w-5 text-slate-500',
              })}
              <h2 className="text-lg font-semibold text-slate-900">
                {channelLabels[activeChannel]} Template
              </h2>
            </div>

            {template.channels.includes(activeChannel) ? (
              <>
                {renderTemplateEditor()}

                <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Available Variables</h3>
                  <div className="flex flex-wrap gap-2">
                    {[
                      '{{workOrder.number}}',
                      '{{workOrder.description}}',
                      '{{workOrder.priority}}',
                      '{{workOrder.status}}',
                      '{{assignee.firstName}}',
                      '{{assignee.lastName}}',
                      '{{assignee.email}}',
                      '{{appUrl}}',
                      '{{now | date}}',
                    ].map((variable) => (
                      <code
                        key={variable}
                        className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600"
                      >
                        {variable}
                      </code>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <p>This channel is not enabled.</p>
                <p className="text-sm">Enable it from the sidebar to configure the template.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-slate-900">Notification Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                <input
                  type="text"
                  value={template.code}
                  onChange={(e) => handleChange('code', e.target.value)}
                  disabled={template.source === 'platform'}
                  placeholder="e.g., wo_assigned"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={template.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  disabled={template.source === 'platform'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={template.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  disabled={template.source === 'platform'}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={template.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    disabled={template.source === 'platform'}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  >
                    <option value="general">General</option>
                    <option value="work_order">Work Order</option>
                    <option value="asset">Asset</option>
                    <option value="inventory">Inventory</option>
                    <option value="user">User</option>
                    <option value="system">System</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Trigger Event
                  </label>
                  <input
                    type="text"
                    value={template.eventCode}
                    onChange={(e) => handleChange('eventCode', e.target.value)}
                    disabled={template.source === 'platform'}
                    placeholder="e.g., work_order.assigned"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Recipients</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                    <select
                      value={template.recipientConfig.type}
                      onChange={(e) =>
                        handleChange('recipientConfig', {
                          ...template.recipientConfig,
                          type: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="user">Specific User</option>
                      <option value="role">Role</option>
                      <option value="group">Group</option>
                      <option value="field">Record Field</option>
                      <option value="dynamic">Dynamic (Script)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Value</label>
                    <input
                      type="text"
                      value={template.recipientConfig.value}
                      onChange={(e) =>
                        handleChange('recipientConfig', {
                          ...template.recipientConfig,
                          value: e.target.value,
                        })
                      }
                      placeholder={
                        template.recipientConfig.type === 'field' ? 'e.g., assigneeId' : ''
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Throttle (minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  value={template.throttleMinutes || 0}
                  onChange={(e) => handleChange('throttleMinutes', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  0 = no throttling. Prevents duplicate notifications within the specified time.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-slate-900">Preview</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {template.templates.email && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Email Preview
                  </h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-sm">
                      <strong>Subject:</strong> {template.templates.email.subject}
                    </div>
                    <div className="p-4">
                      {template.templates.email.isHtml ? (
                        <div
                          dangerouslySetInnerHTML={{ __html: template.templates.email.body }}
                          className="prose prose-sm max-w-none"
                        />
                      ) : (
                        <pre className="whitespace-pre-wrap text-sm">
                          {template.templates.email.body}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {template.templates.in_app && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <Bell className="h-4 w-4" /> In-App Preview
                  </h3>
                  <div className="border border-slate-200 rounded-lg p-4 flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bell className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">
                        {template.templates.in_app.title}
                      </div>
                      <div className="text-sm text-slate-600">
                        {template.templates.in_app.body}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {template.templates.sms && (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" /> SMS Preview
                  </h3>
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <p className="text-sm">{template.templates.sms.body}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationEditorPage;
