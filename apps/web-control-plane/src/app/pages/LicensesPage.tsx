import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Loader2, X, AlertCircle } from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi, Customer, License, LicenseStatus, LicenseType } from '../services/api';

export function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newLicenseData, setNewLicenseData] = useState({
    customerId: '',
    licenseType: 'enterprise' as LicenseType,
    maxUsers: 25,
    maxAssets: 1000,
    expiresAt: '',
  });
  const [issuing, setIssuing] = useState(false);

  const fetchLicenses = async () => {
    try {
      setLoading(true);
      const data = await controlPlaneApi.getLicenses();
      setLicenses(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load licenses:', err);
      setError('Failed to load licenses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      await Promise.all([
        fetchLicenses(),
        controlPlaneApi
          .getCustomers({ limit: 200 })
          .then((res) => setCustomers(res.data))
          .catch((err) => {
            console.error('Failed to load customers:', err);
          }),
      ]);
    };
    load();
  }, []);

  const handleIssueLicense = async () => {
    if (!newLicenseData.customerId) {
      setFormError('Select a customer.');
      return;
    }
    if (!newLicenseData.expiresAt) {
      setFormError('Set an expiration date.');
      return;
    }
    if (newLicenseData.maxUsers <= 0 || newLicenseData.maxAssets <= 0) {
      setFormError('User and asset limits must be greater than zero.');
      return;
    }
    try {
      setIssuing(true);
      setFormError(null);
      await controlPlaneApi.createLicense(newLicenseData);
      setShowIssueDialog(false);
      fetchLicenses();
    } catch (error) {
      console.error('Failed to issue license:', error);
    } finally {
      setIssuing(false);
    }
  };

  const statusConfig: Record<LicenseStatus, { color: string; bg: string }> = {
    active: { color: colors.success.base, bg: colors.success.glow },
    pending: { color: colors.info.base, bg: colors.info.glow },
    expired: { color: colors.danger.base, bg: colors.danger.glow },
    revoked: { color: colors.text.muted, bg: colors.glass.medium },
  };

  const handleRevoke = async (license: License) => {
    if (license.status !== 'active') return;
    const confirmed = window.confirm('Revoke this license?');
    if (!confirmed) return;
    const reason = window.prompt('Revocation reason (optional):') || undefined;
    try {
      await controlPlaneApi.updateLicenseStatus(license.id, { status: 'revoked', revokeReason: reason });
      fetchLicenses();
    } catch (err) {
      console.error('Failed to revoke license:', err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>
          License Management
        </h1>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={fetchLicenses}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
            style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setShowIssueDialog(true);
              setFormError(null);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
            style={{
              background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
            }}
          >
            <Plus size={18} />
            Issue License
          </button>
        </div>
      </div>

      {error && (
        <div
          className="flex items-center gap-3 p-4 rounded-2xl border mb-6"
          style={{
            backgroundColor: colors.danger.glow,
            borderColor: colors.danger.base,
            color: colors.danger.base,
          }}
        >
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.brand.primary }} />
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: colors.glass.subtle }}>
                {['Customer', 'Type', 'Status', 'Expires', 'Max Users', 'Max Assets', 'Actions'].map((h) => (
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
              {licenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8" style={{ color: colors.text.tertiary }}>
                    No licenses found.
                  </td>
                </tr>
              ) : (
                licenses.map((license) => {
                  const status = statusConfig[license.status] || { color: colors.text.muted, bg: colors.glass.medium };
                  return (
                    <tr
                      key={license.id}
                      className="transition-colors"
                      style={{ borderTop: `1px solid ${colors.glass.border}` }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.glass.subtle)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: colors.text.primary }}>
                          {license.customer?.name || license.customerId}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm capitalize" style={{ color: colors.text.secondary }}>
                          {license.licenseType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-semibold capitalize"
                          style={{ backgroundColor: status.bg, color: status.color }}
                        >
                          {license.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: colors.text.secondary }}>
                          {license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: colors.text.secondary }}>
                          {license.maxUsers ?? '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: colors.text.secondary }}>
                          {license.maxAssets ?? '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleRevoke(license)}
                          className="px-3 py-1.5 rounded text-xs font-semibold transition-colors"
                          style={{
                            backgroundColor: license.status === 'active' ? colors.danger.glow : colors.glass.subtle,
                            color: license.status === 'active' ? colors.danger.base : colors.text.muted,
                            cursor: license.status === 'active' ? 'pointer' : 'not-allowed',
                          }}
                          disabled={license.status !== 'active'}
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Issue License Dialog */}
      {showIssueDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60">
          <div
            className="w-full max-w-md p-6 rounded-2xl border"
            style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                Issue New License
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowIssueDialog(false);
                  setFormError(null);
                }}
                className="p-1.5 rounded transition-colors"
                style={{ color: colors.text.muted }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Customer
                </label>
                <select
                  value={newLicenseData.customerId}
                  onChange={(e) => {
                    setNewLicenseData({ ...newLicenseData, customerId: e.target.value });
                    setFormError(null);
                  }}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                  style={{
                    backgroundColor: colors.glass.medium,
                    borderColor: colors.glass.border,
                    color: colors.text.primary,
                  }}
                >
                  <option value="">Select customer...</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  License Type
                </label>
                <select
                  value={newLicenseData.licenseType}
                  onChange={(e) => setNewLicenseData({ ...newLicenseData, licenseType: e.target.value as LicenseType })}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                  style={{
                    backgroundColor: colors.glass.medium,
                    borderColor: colors.glass.border,
                    color: colors.text.primary,
                  }}
                >
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Max Users
                </label>
                <input
                  type="number"
                  min={1}
                  value={newLicenseData.maxUsers}
                  onChange={(e) => setNewLicenseData({ ...newLicenseData, maxUsers: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                  style={{
                    backgroundColor: colors.glass.medium,
                    borderColor: colors.glass.border,
                    color: colors.text.primary,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Max Assets
                </label>
                <input
                  type="number"
                  min={1}
                  value={newLicenseData.maxAssets}
                  onChange={(e) => setNewLicenseData({ ...newLicenseData, maxAssets: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                  style={{
                    backgroundColor: colors.glass.medium,
                    borderColor: colors.glass.border,
                    color: colors.text.primary,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Expiration Date
                </label>
                <input
                  type="date"
                  value={newLicenseData.expiresAt}
                  onChange={(e) => {
                    setNewLicenseData({ ...newLicenseData, expiresAt: e.target.value });
                    setFormError(null);
                  }}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                  style={{
                    backgroundColor: colors.glass.medium,
                    borderColor: colors.glass.border,
                    color: colors.text.primary,
                  }}
                />
              </div>
            </div>

            {formError && (
              <div
                className="mt-4 p-3 rounded-lg text-sm"
                style={{ backgroundColor: colors.danger.glow, color: colors.danger.base }}
              >
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowIssueDialog(false);
                  setFormError(null);
                }}
                className="px-4 py-2 rounded-lg border text-sm font-medium"
                style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleIssueLicense}
                disabled={issuing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-opacity disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
                }}
              >
                {issuing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Issue License
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LicensesPage;
