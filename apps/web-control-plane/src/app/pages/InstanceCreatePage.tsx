import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, Server, Loader2, AlertCircle } from 'lucide-react';
import { controlPlaneApi, Customer } from '../services/api';
import { colors } from '../theme/theme';

export function InstanceCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    customerId: location.state?.customerId || '',
    environment: 'dev',
    region: 'us-east-2',
    version: '',
    resourceTier: 'standard',
  });

  useEffect(() => {
    async function loadCustomers() {
      try {
        const response = await controlPlaneApi.getCustomers({ page: 1, limit: 200 });
        setCustomers(response.data);
      } catch (err) {
        console.error('Failed to load customers:', err);
        setError('Failed to load customers list');
      } finally {
        setLoading(false);
      }
    }
    loadCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) {
      setError('Please select a customer');
      return;
    }
    if (!formData.version.trim()) {
      setError('Platform release id is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const instance = await controlPlaneApi.createInstance(formData);
      await controlPlaneApi.provisionInstance(instance.id);
      navigate('/instances');
    } catch (err: any) {
      console.error('Failed to create instance:', err);
      setError(err.response?.data?.message || err.message || 'Failed to create instance');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.brand.primary }} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button
        type="button"
        onClick={() => navigate('/instances')}
        className="flex items-center gap-2 text-sm mb-6 transition-colors"
        style={{ color: colors.text.secondary }}
      >
        <ArrowLeft size={16} />
        Back to Instances
      </button>

      <h1 className="text-xl font-bold mb-6" style={{ color: colors.text.primary }}>
        Provision New Instance
      </h1>

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

      <form onSubmit={handleSubmit}>
        <div
          className="p-6 rounded-2xl border"
          style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.glow }}>
              <Server size={24} style={{ color: colors.brand.primary }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>
                Instance Configuration
              </h2>
              <p className="text-sm" style={{ color: colors.text.tertiary }}>
                Configure deployment details for the new customer instance
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Customer *
              </label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                style={{
                  backgroundColor: colors.glass.medium,
                  borderColor: colors.glass.border,
                  color: colors.text.primary,
                }}
              >
                <option value="">Select a customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Environment
              </label>
              <select
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                style={{
                  backgroundColor: colors.glass.medium,
                  borderColor: colors.glass.border,
                  color: colors.text.primary,
                }}
              >
                <option value="dev">Dev</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Region
              </label>
              <select
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                style={{
                  backgroundColor: colors.glass.medium,
                  borderColor: colors.glass.border,
                  color: colors.text.primary,
                }}
              >
                <option value="us-east-2">US East (Ohio)</option>
                <option value="us-east-1">US East (N. Virginia)</option>
                <option value="us-west-2">US West (Oregon)</option>
                <option value="eu-west-1">EU (Ireland)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Platform Release ID
              </label>
              <input
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                style={{
                  backgroundColor: colors.glass.medium,
                  borderColor: colors.glass.border,
                  color: colors.text.primary,
                }}
                placeholder="YYYYMMDD-<git-sha>"
              />
              <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                Use the immutable platform release id for this deployment.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Resource Tier
              </label>
              <select
                value={formData.resourceTier}
                onChange={(e) => setFormData({ ...formData, resourceTier: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                style={{
                  backgroundColor: colors.glass.medium,
                  borderColor: colors.glass.border,
                  color: colors.text.primary,
                }}
              >
                <option value="standard">Standard (2 vCPU, 4GB RAM)</option>
                <option value="professional">Professional (4 vCPU, 8GB RAM)</option>
                <option value="enterprise">Enterprise (8 vCPU, 16GB RAM)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={() => navigate('/instances')}
              disabled={submitting}
              className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                borderColor: colors.glass.border,
                color: colors.text.secondary,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-opacity disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
              }}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check size={18} />}
              {submitting ? 'Provisioning...' : 'Provision Instance'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default InstanceCreatePage;
