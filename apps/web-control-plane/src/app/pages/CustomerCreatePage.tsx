import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi } from '../services/api';

export function CustomerCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    primaryContactEmail: '',
    primaryContactName: '',
    tier: 'starter',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await controlPlaneApi.createCustomer({
        name: formData.name,
        code: formData.code,
        primaryContactEmail: formData.primaryContactEmail,
        primaryContactName: formData.primaryContactName,
        tier: formData.tier as any,
      });
      navigate('/customers');
    } catch (err: any) {
      console.error('Failed to create customer:', err);
      setError(err.response?.data?.message || 'Failed to create customer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate('/customers')}
          className="p-2 rounded-lg transition-colors"
          style={{ color: colors.text.secondary }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>
          New Customer
        </h1>
      </div>

      {error && (
        <div
          className="flex items-start gap-3 p-4 rounded-xl mb-6"
          style={{
            backgroundColor: colors.danger.glow,
            border: `1px solid ${colors.danger.base}`,
          }}
        >
          <AlertCircle size={18} style={{ color: colors.danger.base, flexShrink: 0, marginTop: 2 }} />
          <p className="text-sm" style={{ color: colors.danger.base }}>
            {error}
          </p>
        </div>
      )}

      <div
        className="p-6 rounded-2xl border"
        style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
      >
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Customer Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g. Acme Corp"
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
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
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Customer Code *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
                placeholder="e.g. acme"
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
                style={{
                  backgroundColor: colors.glass.medium,
                  borderColor: colors.glass.border,
                  color: colors.text.primary,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = colors.brand.primary)}
                onBlur={(e) => (e.currentTarget.style.borderColor = colors.glass.border)}
              />
              <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                Unique identifier for URL and internal use
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Primary Contact Name *
              </label>
              <input
                type="text"
                value={formData.primaryContactName}
                onChange={(e) => setFormData({ ...formData, primaryContactName: e.target.value })}
                required
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
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
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Primary Contact Email *
              </label>
              <input
                type="email"
                value={formData.primaryContactEmail}
                onChange={(e) => setFormData({ ...formData, primaryContactEmail: e.target.value })}
                required
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
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
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Tier
              </label>
              <select
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
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
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={() => navigate('/customers')}
              className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
              style={{
                borderColor: colors.glass.border,
                color: colors.text.secondary,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-opacity disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
              Create Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CustomerCreatePage;
