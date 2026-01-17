import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Server,
  Users,
  DollarSign,
  Settings,
  Activity,
  Plus,
  MoreVertical,
  RefreshCw,
  ExternalLink,
  Cpu,
  HardDrive,
  AlertTriangle,
  Save,
  CheckCircle,
  XCircle,
  Database,
  Loader2,
  Building2,
} from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi, Customer, CustomerSettings, AuditLog } from '../services/api';

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: colors.success.base, bg: colors.success.glow, label: 'Active' },
  trial: { color: colors.info.base, bg: colors.info.glow, label: 'Trial' },
  suspended: { color: colors.warning.base, bg: colors.warning.glow, label: 'Suspended' },
  churned: { color: colors.danger.base, bg: colors.danger.glow, label: 'Churned' },
  pending: { color: colors.warning.base, bg: colors.warning.glow, label: 'Pending' },
  terminated: { color: colors.danger.base, bg: colors.danger.glow, label: 'Terminated' },
};

const tierConfig: Record<string, { color: string; bg: string; label: string }> = {
  enterprise: { color: colors.brand.primary, bg: colors.brand.glow, label: 'Enterprise' },
  professional: { color: colors.cyan.base, bg: colors.cyan.glow, label: 'Professional' },
  starter: { color: colors.text.secondary, bg: colors.glass.medium, label: 'Starter' },
};

const healthConfig: Record<string, { color: string; icon: any }> = {
  healthy: { color: colors.success.base, icon: CheckCircle },
  degraded: { color: colors.warning.base, icon: AlertTriangle },
  unhealthy: { color: colors.danger.base, icon: XCircle },
  unknown: { color: colors.text.muted, icon: Activity },
};

const envConfig: Record<string, { color: string; bg: string }> = {
  production: { color: colors.success.base, bg: colors.success.glow },
  staging: { color: colors.warning.base, bg: colors.warning.glow },
  dev: { color: colors.info.base, bg: colors.info.glow },
};

const defaultCustomerSettings: CustomerSettings = {
  features: {
    ai_assistant: true,
    advanced_analytics: false,
    custom_integrations: false,
    mobile_app: true,
    sso: false,
    audit_logs: true,
  },
  security: {
    mfa_required: false,
    ip_whitelist: [],
    session_timeout: 120,
    password_policy: 'standard',
  },
  notifications: {
    email_alerts: true,
    slack_integration: false,
    webhook_url: '',
  },
  backup: {
    frequency: 'daily',
    retention_days: 30,
    cross_region: false,
  },
  api: {
    rate_limit: 2000,
    burst_limit: 100,
  },
  branding: {
    primary_color: '',
    logo_url: '',
    custom_domain: '',
  },
};

const normalizeCustomerSettings = (
  settings?: CustomerSettings | null
): CustomerSettings => ({
  ...defaultCustomerSettings,
  ...settings,
  features: {
    ...defaultCustomerSettings.features,
    ...(settings?.features ?? {}),
  },
  security: {
    ...defaultCustomerSettings.security,
    ...(settings?.security ?? {}),
  },
  notifications: {
    ...defaultCustomerSettings.notifications,
    ...(settings?.notifications ?? {}),
  },
  backup: {
    ...defaultCustomerSettings.backup,
    ...(settings?.backup ?? {}),
  },
  api: {
    ...defaultCustomerSettings.api,
    ...(settings?.api ?? {}),
  },
  branding: {
    ...defaultCustomerSettings.branding,
    ...(settings?.branding ?? {}),
  },
});

type CustomerEditDraft = {
  name: string;
  status: Customer['status'];
  tier: Customer['tier'];
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  mrr: number;
  contractStart: string;
  contractEnd: string;
};

const toDateInputValue = (value?: string | null) =>
  value ? value.split('T')[0] : '';

const buildEditDraft = (customer: Customer): CustomerEditDraft => ({
  name: customer.name || '',
  status: customer.status,
  tier: customer.tier,
  primaryContactName: customer.primaryContactName || '',
  primaryContactEmail: customer.primaryContactEmail || '',
  primaryContactPhone: customer.primaryContactPhone || '',
  mrr: customer.mrr || 0,
  contractStart: toDateInputValue(customer.contractStart),
  contractEnd: toDateInputValue(customer.contractEnd),
});

interface ToggleFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  color?: string;
}

function ToggleField({ label, checked, onChange, description, color }: ToggleFieldProps) {
  const activeColor = color || colors.success.base;
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors mt-0.5"
        style={{
          backgroundColor: checked ? activeColor : colors.glass.medium,
        }}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
      <div>
        <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
          {label}
        </span>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: colors.text.secondary }}>
            {description}
          </p>
        )}
      </div>
    </label>
  );
}

export function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tabValue, setTabValue] = useState(0);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsDraft, setSettingsDraft] = useState<CustomerSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === '1');
  const [editDraft, setEditDraft] = useState<CustomerEditDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [activityLogs, setActivityLogs] = useState<AuditLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  const loadCustomer = useCallback(async () => {
    if (!id || id === 'new') return;
    try {
      setLoading(true);
      const data = await controlPlaneApi.getCustomer(id);
      setCustomer(data);
      setSettingsDraft(normalizeCustomerSettings(data.settings));
      setEditDraft(buildEditDraft(data));
      setEditSaved(false);
      setEditError(null);
      setActionError(null);
      setSettingsError(null);
    } catch (err) {
      console.error('Failed to load customer:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  useEffect(() => {
    const shouldEdit = searchParams.get('edit') === '1';
    setIsEditing(shouldEdit);
  }, [searchParams]);

  const syncEditParam = (next: boolean) => {
    const nextParams = new URLSearchParams(searchParams);
    if (next) {
      nextParams.set('edit', '1');
    } else {
      nextParams.delete('edit');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const setEditMode = (next: boolean) => {
    setIsEditing(next);
    syncEditParam(next);
    if (!next && customer) {
      setEditDraft(buildEditDraft(customer));
      setEditError(null);
      setEditSaved(false);
    }
  };

  const handleEditSave = async () => {
    if (!customer || !editDraft) return;
    try {
      setEditSaving(true);
      setEditError(null);
      setActionError(null);
      const payload = {
        name: editDraft.name.trim(),
        status: editDraft.status,
        tier: editDraft.tier,
        primaryContactName: editDraft.primaryContactName.trim() || undefined,
        primaryContactEmail: editDraft.primaryContactEmail.trim() || undefined,
        primaryContactPhone: editDraft.primaryContactPhone.trim() || undefined,
        mrr: Number(editDraft.mrr) || 0,
        contractStart: editDraft.contractStart || undefined,
        contractEnd: editDraft.contractEnd || undefined,
      };
      const updated = await controlPlaneApi.updateCustomer(customer.id, payload);
      setCustomer(updated);
      setEditDraft(buildEditDraft(updated));
      setEditSaved(true);
      syncEditParam(false);
      setIsEditing(false);
      setTimeout(() => setEditSaved(false), 2500);
    } catch (err: any) {
      console.error('Failed to update customer:', err);
      setEditError(err.response?.data?.message || 'Failed to update customer.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customer) return;
    const confirmed = window.confirm(
      `Delete ${customer.name}? This removes the customer from the control plane.`
    );
    if (!confirmed) return;
    try {
      setDeleteSaving(true);
      setActionError(null);
      await controlPlaneApi.deleteCustomer(customer.id);
      navigate('/customers');
    } catch (err) {
      console.error('Failed to delete customer:', err);
      setActionError('Failed to delete customer.');
    } finally {
      setDeleteSaving(false);
    }
  };

  const handleSettingsSave = async () => {
    if (!customer || !settingsDraft) return;
    try {
      setSettingsSaving(true);
      setSettingsSaved(false);
      const updated = await controlPlaneApi.updateCustomerSettings(
        customer.id,
        settingsDraft,
      );
      setCustomer(updated);
      setSettingsDraft(normalizeCustomerSettings(updated.settings));
      setSettingsSaved(true);
      setSettingsError(null);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err: any) {
      console.error('Failed to update customer settings:', err);
      setSettingsError(err.response?.data?.message || 'Failed to update settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleOpenInstance = (domain?: string | null) => {
    if (!domain) return;
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const loadActivity = useCallback(async () => {
    if (!customer) return;
    try {
      setActivityLoading(true);
      const data = await controlPlaneApi.getAuditLogs({
        customerId: customer.id,
        page: 1,
        limit: 20,
      });
      setActivityLogs(data.data);
      setActivityError(null);
    } catch (err: any) {
      console.error('Failed to load activity logs:', err);
      setActivityError(err.response?.data?.message || 'Failed to load activity logs.');
    } finally {
      setActivityLoading(false);
    }
  }, [customer]);

  useEffect(() => {
    if (tabValue !== 3) return;
    loadActivity();
  }, [tabValue, loadActivity]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.brand.primary }} />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-16" style={{ color: colors.danger.base }}>
        Customer not found
      </div>
    );
  }

  const status = statusConfig[customer.status] || { color: colors.text.muted, bg: colors.glass.medium, label: customer.status };
  const tier = tierConfig[customer.tier] || { color: colors.text.muted, bg: colors.glass.medium, label: customer.tier };

  const tabs = [
    { id: 0, label: 'Overview', icon: Building2 },
    { id: 1, label: 'Instances', icon: Server },
    { id: 2, label: 'Settings', icon: Settings },
    { id: 3, label: 'Activity', icon: Activity },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate('/customers')}
          className="p-2 rounded-lg transition-colors"
          style={{ color: colors.text.secondary }}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: colors.glass.medium, color: colors.text.secondary }}
            >
              {customer.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>
                  {customer.name}
                </h1>
                <span
                  className="px-2 py-0.5 rounded text-xs font-semibold"
                  style={{ backgroundColor: status.bg, color: status.color }}
                >
                  {status.label}
                </span>
                <span
                  className="px-2 py-0.5 rounded text-xs font-semibold"
                  style={{ backgroundColor: tier.bg, color: tier.color }}
                >
                  {tier.label}
                </span>
              </div>
              <p className="text-sm" style={{ color: colors.text.tertiary }}>
                {customer.code} • Created {new Date(customer.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditMode(!isEditing)}
            className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
            style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
          >
            {isEditing ? 'Cancel Edit' : 'Edit Customer'}
          </button>
          <button
            type="button"
            onClick={handleDeleteCustomer}
            disabled={deleteSaving}
            className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-60"
            style={{ borderColor: colors.danger.base, color: colors.danger.base }}
          >
            {deleteSaving ? 'Deleting...' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/instances/new', { state: { customerId: customer.id } })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
            style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
          >
            <Plus size={18} />
            Provision Instance
          </button>
        </div>
      </div>

      {actionError && (
        <div
          className="p-4 rounded-xl border mb-6"
          style={{
            backgroundColor: colors.danger.glow,
            borderColor: colors.danger.base,
            color: colors.danger.base,
          }}
        >
          {actionError}
        </div>
      )}

      {editSaved && (
        <div
          className="p-4 rounded-xl border mb-6"
          style={{
            backgroundColor: colors.success.glow,
            borderColor: colors.success.base,
            color: colors.success.base,
          }}
        >
          Customer updated successfully.
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { icon: DollarSign, label: 'MRR', value: `$${((customer.mrr || 0) / 1000).toFixed(0)}K`, color: colors.success.base },
          { icon: Users, label: 'Users', value: `${((customer.totalUsers || 0) / 1000).toFixed(1)}K`, color: colors.info.base },
          { icon: Database, label: 'Assets', value: `${((customer.totalAssets || 0) / 1000000).toFixed(1)}M`, color: colors.warning.base },
          { icon: Server, label: 'Instances', value: customer.instances?.length || 0, color: colors.brand.primary },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-4 rounded-2xl border"
            style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon size={16} style={{ color: stat.color }} />
              <span className="text-xs" style={{ color: colors.text.tertiary }}>{stat.label}</span>
            </div>
            <div className="text-xl font-bold" style={{ color: colors.text.primary }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Card */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
      >
        {/* Tab Headers */}
        <div className="flex border-b" style={{ borderColor: colors.glass.border }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTabValue(tab.id)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors"
              style={{
                color: tabValue === tab.id ? colors.text.primary : colors.text.secondary,
                borderBottom: tabValue === tab.id ? `2px solid ${colors.brand.primary}` : '2px solid transparent',
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {tabValue === 0 && (
            <>
              {isEditing && editDraft ? (
                <div className="space-y-6">
                  {editError && (
                    <div
                      className="flex items-center gap-3 p-4 rounded-xl"
                      style={{
                        backgroundColor: colors.danger.glow,
                        border: `1px solid ${colors.danger.base}`,
                      }}
                    >
                      <AlertTriangle size={18} style={{ color: colors.danger.base }} />
                      <span className="text-sm" style={{ color: colors.danger.base }}>
                        {editError}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-sm font-semibold mb-4" style={{ color: colors.text.tertiary }}>
                        Customer Details
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Customer Name
                          </label>
                          <input
                            type="text"
                            value={editDraft.name}
                            onChange={(e) =>
                              setEditDraft((prev) =>
                                prev ? { ...prev, name: e.target.value } : prev
                              )
                            }
                            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = colors.brand.primary)}
                            onBlur={(e) => (e.currentTarget.style.borderColor = colors.glass.border)}
                          />
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Status
                          </label>
                          <select
                            value={editDraft.status}
                            onChange={(e) =>
                              setEditDraft((prev) =>
                                prev
                                  ? { ...prev, status: e.target.value as Customer['status'] }
                                  : prev
                              )
                            }
                            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                          >
                            {[
                              { value: 'pending', label: 'Pending' },
                              { value: 'active', label: 'Active' },
                              { value: 'trial', label: 'Trial' },
                              { value: 'suspended', label: 'Suspended' },
                              { value: 'churned', label: 'Churned' },
                              { value: 'terminated', label: 'Terminated' },
                            ].map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Tier
                          </label>
                          <select
                            value={editDraft.tier}
                            onChange={(e) =>
                              setEditDraft((prev) =>
                                prev
                                  ? { ...prev, tier: e.target.value as Customer['tier'] }
                                  : prev
                              )
                            }
                            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                          >
                            {[
                              { value: 'starter', label: 'Starter' },
                              { value: 'professional', label: 'Professional' },
                              { value: 'enterprise', label: 'Enterprise' },
                            ].map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Primary Contact Name
                          </label>
                          <input
                            type="text"
                            value={editDraft.primaryContactName}
                            onChange={(e) =>
                              setEditDraft((prev) =>
                                prev ? { ...prev, primaryContactName: e.target.value } : prev
                              )
                            }
                            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = colors.brand.primary)}
                            onBlur={(e) => (e.currentTarget.style.borderColor = colors.glass.border)}
                          />
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Primary Contact Email
                          </label>
                          <input
                            type="email"
                            value={editDraft.primaryContactEmail}
                            onChange={(e) =>
                              setEditDraft((prev) =>
                                prev ? { ...prev, primaryContactEmail: e.target.value } : prev
                              )
                            }
                            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = colors.brand.primary)}
                            onBlur={(e) => (e.currentTarget.style.borderColor = colors.glass.border)}
                          />
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Primary Contact Phone
                          </label>
                          <input
                            type="text"
                            value={editDraft.primaryContactPhone}
                            onChange={(e) =>
                              setEditDraft((prev) =>
                                prev ? { ...prev, primaryContactPhone: e.target.value } : prev
                              )
                            }
                            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = colors.brand.primary)}
                            onBlur={(e) => (e.currentTarget.style.borderColor = colors.glass.border)}
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold mb-4" style={{ color: colors.text.tertiary }}>
                        Contract & Configuration
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            MRR (USD)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={editDraft.mrr}
                            onChange={(e) =>
                              setEditDraft((prev) =>
                                prev ? { ...prev, mrr: Number(e.target.value) } : prev
                              )
                            }
                            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Contract Start
                          </label>
                          <input
                            type="date"
                            value={editDraft.contractStart}
                            onChange={(e) =>
                              setEditDraft((prev) =>
                                prev ? { ...prev, contractStart: e.target.value } : prev
                              )
                            }
                            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Contract End
                          </label>
                          <input
                            type="date"
                            value={editDraft.contractEnd}
                            onChange={(e) =>
                              setEditDraft((prev) =>
                                prev ? { ...prev, contractEnd: e.target.value } : prev
                              )
                            }
                            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                          />
                        </div>
                        <div
                          className="pt-4 border-t"
                          style={{ borderColor: colors.glass.border }}
                        >
                          <div className="space-y-3">
                            <div>
                              <span className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                                Custom Domain
                              </span>
                              <span className="text-sm" style={{ color: colors.text.primary }}>
                                {customer.settings?.branding?.custom_domain || 'Not configured'}
                              </span>
                            </div>
                            <div>
                              <span className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                                SSO
                              </span>
                              <span className="text-sm" style={{ color: colors.text.primary }}>
                                {customer.settings?.features?.sso ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
                      style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleEditSave}
                      disabled={editSaving}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-opacity disabled:opacity-50"
                      style={{
                        background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
                      }}
                    >
                      {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
                      {editSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-sm font-semibold mb-4" style={{ color: colors.text.tertiary }}>
                      Contact Information
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                          Primary Contact
                        </span>
                        <span className="text-sm" style={{ color: colors.text.primary }}>
                          {customer.primaryContactName || 'Not specified'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                          Email
                        </span>
                        <span className="text-sm" style={{ color: colors.text.primary }}>
                          {customer.primaryContactEmail || 'Not specified'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                          Phone
                        </span>
                        <span className="text-sm" style={{ color: colors.text.primary }}>
                          {customer.primaryContactPhone || 'Not specified'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-4" style={{ color: colors.text.tertiary }}>
                      Configuration
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                          Custom Domain
                        </span>
                        <span className="text-sm" style={{ color: colors.text.primary }}>
                          {customer.settings?.branding?.custom_domain || 'Not configured'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                          SSO
                        </span>
                        <span className="text-sm" style={{ color: colors.text.primary }}>
                          {customer.settings?.features?.sso ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Instances Tab */}
          {tabValue === 1 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.glass.border}` }}>
                    {['Environment', 'Status', 'Health', 'Version', 'Region', 'Resources', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: colors.text.tertiary }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customer.instances?.map((instance) => {
                    const health = healthConfig[instance.health] || { color: colors.text.muted, icon: Activity };
                    const env = envConfig[instance.environment] || { color: colors.text.muted, bg: colors.glass.medium };
                    const HealthIcon = health.icon;

                    return (
                      <tr
                        key={instance.id}
                        className="transition-colors"
                        style={{ borderBottom: `1px solid ${colors.glass.border}` }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.glass.subtle)}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td className="px-4 py-3">
                          <span
                            className="px-2 py-0.5 rounded text-xs font-semibold capitalize"
                            style={{ backgroundColor: env.bg, color: env.color }}
                          >
                            {instance.environment}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor: instance.status === 'active' ? colors.success.base : colors.warning.base,
                              }}
                            />
                            <span className="text-sm capitalize" style={{ color: colors.text.secondary }}>
                              {instance.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <HealthIcon size={16} style={{ color: health.color }} />
                            <span className="text-sm capitalize" style={{ color: colors.text.secondary }}>
                              {instance.health}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm" style={{ color: colors.text.secondary }}>{instance.version}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm" style={{ color: colors.text.secondary }}>{instance.region}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-4">
                            <div
                              className="flex items-center gap-1"
                              title={`CPU: ${instance.resourceMetrics?.cpu_usage || 0}%`}
                            >
                              <Cpu size={14} style={{ color: colors.text.muted }} />
                              <span className="text-xs" style={{ color: colors.text.secondary }}>
                                {instance.resourceMetrics?.cpu_usage || 0}%
                              </span>
                            </div>
                            <div
                              className="flex items-center gap-1"
                              title={`Memory: ${instance.resourceMetrics?.memory_usage || 0}%`}
                            >
                              <HardDrive size={14} style={{ color: colors.text.muted }} />
                              <span className="text-xs" style={{ color: colors.text.secondary }}>
                                {instance.resourceMetrics?.memory_usage || 0}%
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className="p-1.5 rounded transition-colors disabled:opacity-50"
                              title={instance.domain ? 'Open Console' : 'Domain not available'}
                              style={{ color: colors.text.muted }}
                              disabled={!instance.domain}
                              onClick={() => handleOpenInstance(instance.domain)}
                            >
                              <ExternalLink size={16} />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 rounded transition-colors"
                              title="Refresh"
                              style={{ color: colors.text.muted }}
                              onClick={loadCustomer}
                            >
                              <RefreshCw size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Settings Tab */}
          {tabValue === 2 && (
            <div className="space-y-6">
              {settingsSaved && (
                <div
                  className="flex items-center gap-3 p-4 rounded-xl"
                  style={{
                    backgroundColor: colors.success.glow,
                    border: `1px solid ${colors.success.base}`,
                  }}
                >
                  <CheckCircle size={18} style={{ color: colors.success.base }} />
                  <span className="text-sm" style={{ color: colors.success.base }}>
                    Settings updated successfully.
                  </span>
                </div>
              )}
              {settingsError && (
                <div
                  className="flex items-center gap-3 p-4 rounded-xl"
                  style={{
                    backgroundColor: colors.danger.glow,
                    border: `1px solid ${colors.danger.base}`,
                  }}
                >
                  <AlertTriangle size={18} style={{ color: colors.danger.base }} />
                  <span className="text-sm" style={{ color: colors.danger.base }}>
                    {settingsError}
                  </span>
                </div>
              )}

              {!settingsDraft ? (
                <div className="text-center py-8" style={{ color: colors.text.tertiary }}>
                  Loading settings...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-6">
                    <div
                      className="p-4 rounded-xl border"
                      style={{ borderColor: colors.glass.border }}
                    >
                      <h3 className="text-sm font-semibold mb-4" style={{ color: colors.text.primary }}>
                        Features
                      </h3>
                      <div className="space-y-3">
                        <ToggleField
                          label="AVA Assistant"
                          checked={settingsDraft.features.ai_assistant}
                          onChange={(checked) =>
                            setSettingsDraft((prev) =>
                              prev
                                ? { ...prev, features: { ...prev.features, ai_assistant: checked } }
                                : prev
                            )
                          }
                        />
                        <ToggleField
                          label="Advanced Analytics"
                          checked={settingsDraft.features.advanced_analytics}
                          onChange={(checked) =>
                            setSettingsDraft((prev) =>
                              prev
                                ? { ...prev, features: { ...prev.features, advanced_analytics: checked } }
                                : prev
                            )
                          }
                        />
                        <ToggleField
                          label="Custom Integrations"
                          checked={settingsDraft.features.custom_integrations}
                          onChange={(checked) =>
                            setSettingsDraft((prev) =>
                              prev
                                ? { ...prev, features: { ...prev.features, custom_integrations: checked } }
                                : prev
                            )
                          }
                        />
                        <ToggleField
                          label="Mobile App"
                          checked={settingsDraft.features.mobile_app}
                          onChange={(checked) =>
                            setSettingsDraft((prev) =>
                              prev
                                ? { ...prev, features: { ...prev.features, mobile_app: checked } }
                                : prev
                            )
                          }
                        />
                        <ToggleField
                          label="SSO"
                          checked={settingsDraft.features.sso}
                          onChange={(checked) =>
                            setSettingsDraft((prev) =>
                              prev
                                ? { ...prev, features: { ...prev.features, sso: checked } }
                                : prev
                            )
                          }
                        />
                        <ToggleField
                          label="Audit Logs"
                          checked={settingsDraft.features.audit_logs}
                          onChange={(checked) =>
                            setSettingsDraft((prev) =>
                              prev
                                ? { ...prev, features: { ...prev.features, audit_logs: checked } }
                                : prev
                            )
                          }
                        />
                      </div>
                    </div>

                    <div
                      className="p-4 rounded-xl border"
                      style={{ borderColor: colors.glass.border }}
                    >
                      <h3 className="text-sm font-semibold mb-4" style={{ color: colors.text.primary }}>
                        Security
                      </h3>
                      <div className="space-y-3">
                        <ToggleField
                          label="Require MFA"
                          checked={settingsDraft.security.mfa_required}
                          onChange={(checked) =>
                            setSettingsDraft((prev) =>
                              prev
                                ? { ...prev, security: { ...prev.security, mfa_required: checked } }
                                : prev
                            )
                          }
                          color={colors.warning.base}
                        />
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Session Timeout (minutes)
                          </label>
                          <input
                            type="number"
                            value={settingsDraft.security.session_timeout}
                            onChange={(e) =>
                              setSettingsDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      security: {
                                        ...prev.security,
                                        session_timeout: Number(e.target.value),
                                      },
                                    }
                                  : prev
                              )
                            }
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Password Policy
                          </label>
                          <select
                            value={settingsDraft.security.password_policy}
                            onChange={(e) =>
                              setSettingsDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      security: {
                                        ...prev.security,
                                        password_policy: e.target.value as CustomerSettings['security']['password_policy'],
                                      },
                                    }
                                  : prev
                              )
                            }
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                          >
                            <option value="standard">Standard</option>
                            <option value="strong">Strong</option>
                            <option value="enterprise">Enterprise</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            IP Allowlist (comma-separated)
                          </label>
                          <input
                            type="text"
                            value={settingsDraft.security.ip_whitelist.join(', ')}
                            onChange={(e) => {
                              const entries = e.target.value
                                .split(',')
                                .map((entry) => entry.trim())
                                .filter(Boolean);
                              setSettingsDraft((prev) =>
                                prev
                                  ? { ...prev, security: { ...prev.security, ip_whitelist: entries } }
                                  : prev
                              );
                            }}
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div
                      className="p-4 rounded-xl border"
                      style={{ borderColor: colors.glass.border }}
                    >
                      <h3 className="text-sm font-semibold mb-4" style={{ color: colors.text.primary }}>
                        Notifications
                      </h3>
                      <div className="space-y-3">
                        <ToggleField
                          label="Email Alerts"
                          checked={settingsDraft.notifications.email_alerts}
                          onChange={(checked) =>
                            setSettingsDraft((prev) =>
                              prev
                                ? { ...prev, notifications: { ...prev.notifications, email_alerts: checked } }
                                : prev
                            )
                          }
                        />
                        <ToggleField
                          label="Slack Integration"
                          checked={settingsDraft.notifications.slack_integration}
                          onChange={(checked) =>
                            setSettingsDraft((prev) =>
                              prev
                                ? { ...prev, notifications: { ...prev.notifications, slack_integration: checked } }
                                : prev
                            )
                          }
                        />
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Webhook URL
                          </label>
                          <input
                            type="url"
                            value={settingsDraft.notifications.webhook_url}
                            onChange={(e) =>
                              setSettingsDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      notifications: { ...prev.notifications, webhook_url: e.target.value },
                                    }
                                  : prev
                              )
                            }
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      className="p-4 rounded-xl border"
                      style={{ borderColor: colors.glass.border }}
                    >
                      <h3 className="text-sm font-semibold mb-4" style={{ color: colors.text.primary }}>
                        Backup
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Frequency
                          </label>
                          <select
                            value={settingsDraft.backup.frequency}
                            onChange={(e) =>
                              setSettingsDraft((prev) =>
                                prev
                                  ? { ...prev, backup: { ...prev.backup, frequency: e.target.value as CustomerSettings['backup']['frequency'] } }
                                  : prev
                              )
                            }
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                          >
                            <option value="hourly">Hourly</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Retention Days
                          </label>
                          <input
                            type="number"
                            value={settingsDraft.backup.retention_days}
                            onChange={(e) =>
                              setSettingsDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      backup: { ...prev.backup, retention_days: Number(e.target.value) },
                                    }
                                  : prev
                              )
                            }
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                          />
                        </div>
                        <ToggleField
                          label="Cross-region Backup"
                          checked={settingsDraft.backup.cross_region}
                          onChange={(checked) =>
                            setSettingsDraft((prev) =>
                              prev
                                ? { ...prev, backup: { ...prev.backup, cross_region: checked } }
                                : prev
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div
                      className="p-4 rounded-xl border"
                      style={{ borderColor: colors.glass.border }}
                    >
                      <h3 className="text-sm font-semibold mb-4" style={{ color: colors.text.primary }}>
                        API Limits
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Rate Limit (per hour)
                          </label>
                          <input
                            type="number"
                            value={settingsDraft.api.rate_limit}
                            onChange={(e) =>
                              setSettingsDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      api: { ...prev.api, rate_limit: Number(e.target.value) },
                                    }
                                  : prev
                              )
                            }
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Burst Limit
                          </label>
                          <input
                            type="number"
                            value={settingsDraft.api.burst_limit}
                            onChange={(e) =>
                              setSettingsDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      api: { ...prev.api, burst_limit: Number(e.target.value) },
                                    }
                                  : prev
                              )
                            }
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      className="p-4 rounded-xl border"
                      style={{ borderColor: colors.glass.border }}
                    >
                      <h3 className="text-sm font-semibold mb-4" style={{ color: colors.text.primary }}>
                        Branding
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Primary Color
                          </label>
                          <input
                            type="text"
                            value={settingsDraft.branding.primary_color}
                            onChange={(e) =>
                              setSettingsDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      branding: { ...prev.branding, primary_color: e.target.value },
                                    }
                                  : prev
                              )
                            }
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Logo URL
                          </label>
                          <input
                            type="url"
                            value={settingsDraft.branding.logo_url}
                            onChange={(e) =>
                              setSettingsDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      branding: { ...prev.branding, logo_url: e.target.value },
                                    }
                                  : prev
                              )
                            }
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs block mb-1" style={{ color: colors.text.muted }}>
                            Custom Domain
                          </label>
                          <input
                            type="text"
                            value={settingsDraft.branding.custom_domain}
                            onChange={(e) =>
                              setSettingsDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      branding: { ...prev.branding, custom_domain: e.target.value },
                                    }
                                  : prev
                              )
                            }
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{
                              backgroundColor: colors.glass.medium,
                              borderColor: colors.glass.border,
                              color: colors.text.primary,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSettingsSave}
                      disabled={settingsSaving}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-opacity disabled:opacity-50"
                      style={{
                        background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
                      }}
                    >
                      {settingsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
                      {settingsSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {tabValue === 3 && (
            <div className="space-y-3">
              {activityLoading ? (
                <div className="text-center py-8" style={{ color: colors.text.tertiary }}>
                  Loading activity...
                </div>
              ) : activityError ? (
                <div
                  className="flex items-center gap-3 p-4 rounded-xl"
                  style={{
                    backgroundColor: colors.danger.glow,
                    border: `1px solid ${colors.danger.base}`,
                  }}
                >
                  <AlertTriangle size={18} style={{ color: colors.danger.base }} />
                  <span className="text-sm" style={{ color: colors.danger.base }}>
                    {activityError}
                  </span>
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-8" style={{ color: colors.text.tertiary }}>
                  No activity logs available.
                </div>
              ) : (
                activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-xl border"
                    style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold" style={{ color: colors.text.primary }}>
                        {log.eventType}
                      </div>
                      <div className="text-xs" style={{ color: colors.text.muted }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-sm mt-2" style={{ color: colors.text.secondary }}>
                      {log.description}
                    </div>
                    <div className="text-xs mt-2" style={{ color: colors.text.muted }}>
                      Target: {log.target} • Severity: {log.severity}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CustomerDetailPage;
