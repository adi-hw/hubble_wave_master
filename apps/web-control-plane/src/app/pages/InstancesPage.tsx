import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, ExternalLink, Terminal } from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi, TenantInstance } from '../services/api';

const envConfig: Record<string, { color: string; bg: string }> = {
  production: { color: colors.success.base, bg: colors.success.glow },
  staging: { color: colors.warning.base, bg: colors.warning.glow },
  dev: { color: colors.info.base, bg: colors.info.glow },
};

const healthConfig: Record<string, { color: string; bg: string }> = {
  healthy: { color: colors.success.base, bg: colors.success.glow },
  degraded: { color: colors.warning.base, bg: colors.warning.glow },
  unhealthy: { color: colors.danger.base, bg: colors.danger.glow },
  unknown: { color: colors.text.muted, bg: colors.glass.medium },
};

const statusConfig: Record<string, { color: string; bg: string }> = {
  active: { color: colors.success.base, bg: colors.success.glow },
  provisioning: { color: colors.info.base, bg: colors.info.glow },
  suspended: { color: colors.warning.base, bg: colors.warning.glow },
  terminated: { color: colors.danger.base, bg: colors.danger.glow },
};

export function InstancesPage() {
  const navigate = useNavigate();
  const [instances, setInstances] = useState<TenantInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const openDomain = (domain?: string | null) => {
    if (!domain) return;
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    window.open(url, '_blank', 'noopener');
  };

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const response = await controlPlaneApi.getInstances();
      setInstances(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch instances:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load instances.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>
          Instances
        </h1>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={fetchInstances}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50"
            style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Sync
          </button>
          <button
            type="button"
            onClick={() => navigate('/instances/new')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
            style={{
              background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
            }}
          >
            <Plus size={18} />
            New Instance
          </button>
        </div>
      </div>

      {error && (
        <div
          className="p-4 rounded-2xl border mb-6"
          style={{
            backgroundColor: colors.danger.glow,
            borderColor: colors.danger.base,
            color: colors.danger.base,
          }}
        >
          {error}
        </div>
      )}

      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: colors.glass.subtle }}>
              {['Domain', 'Customer', 'Env', 'Region', 'Release ID', 'Status', 'Health', 'Actions'].map(
                (header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: colors.text.tertiary }}
                  >
                    {header}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-8" style={{ color: colors.text.secondary }}>
                  Loading instances...
                </td>
              </tr>
            ) : instances.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8" style={{ color: colors.text.secondary }}>
                  No instances found
                </td>
              </tr>
            ) : (
              instances.map((instance) => {
                const env = envConfig[instance.environment as keyof typeof envConfig] || {
                  color: colors.text.muted,
                  bg: colors.glass.medium,
                };
                const health = healthConfig[instance.health as keyof typeof healthConfig] || {
                  color: colors.text.muted,
                  bg: colors.glass.medium,
                };
                const status = statusConfig[instance.status as keyof typeof statusConfig] || {
                  color: colors.text.muted,
                  bg: colors.glass.medium,
                };

                return (
                  <tr
                    key={instance.id}
                    className="transition-colors"
                    style={{ borderTop: `1px solid ${colors.glass.border}` }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = colors.glass.subtle)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = 'transparent')
                    }
                  >
                    <td className="px-4 py-3">
                      {instance.domain ? (
                        <button
                          type="button"
                          onClick={() => openDomain(instance.domain)}
                          className="text-sm font-mono hover:underline"
                          style={{ color: colors.brand.primary }}
                          title="Open instance"
                        >
                          {instance.domain}
                        </button>
                      ) : (
                        <span
                          className="text-sm font-mono"
                          style={{ color: colors.text.primary }}
                        >
                          Pending...
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: colors.text.secondary }}>
                        {instance.customer?.name || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold capitalize"
                        style={{ backgroundColor: env.bg, color: env.color }}
                      >
                        {instance.environment}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: colors.text.secondary }}>
                        {instance.region}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: colors.text.secondary }}>
                        {instance.version}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold capitalize"
                        style={{ backgroundColor: status.bg, color: status.color }}
                      >
                        {instance.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold capitalize"
                        style={{ backgroundColor: health.bg, color: health.color }}
                      >
                        {instance.health}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          type="button"
                          className="p-1.5 rounded transition-colors"
                          style={{ color: colors.text.muted }}
                          onClick={() => openDomain(instance.domain)}
                          title="Open instance"
                          disabled={!instance.domain}
                        >
                          <ExternalLink size={16} />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded transition-colors"
                          style={{ color: colors.text.muted }}
                          onClick={() => navigate(`/terraform?instanceId=${instance.id}`)}
                          title="Terraform jobs"
                        >
                          <Terminal size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default InstancesPage;
