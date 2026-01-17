import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Users,
  Server,
  DollarSign,
  Activity,
  HardDrive,
  Cpu,
  Zap,
  Globe,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi, PlatformMetrics } from '../services/api';

interface ResourceBarProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function ResourceBar({ label, value, icon, color }: ResourceBarProps) {
  return (
    <div className="text-center">
      <div className="mb-3" style={{ color: colors.text.secondary }}>
        {icon}
      </div>
      <div className="text-2xl font-bold mb-2" style={{ color: colors.text.primary }}>
        {value}%
      </div>
      <div className="text-sm mb-3" style={{ color: colors.text.tertiary }}>
        {label}
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: colors.glass.medium }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function MetricsPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const data = await controlPlaneApi.getMetrics();
      setMetrics(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch metrics:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const calculateHealth = (m: PlatformMetrics) => {
    if (m.instances.total === 0) return 100;
    return Math.round((m.instances.healthy / m.instances.total) * 100);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.brand.primary }} />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div
        className="flex items-center gap-3 p-4 rounded-2xl border"
        style={{
          backgroundColor: colors.danger.glow,
          borderColor: colors.danger.base,
          color: colors.danger.base,
        }}
      >
        <AlertCircle size={18} />
        <span>{error || 'No metrics data available'}</span>
        <button
          type="button"
          onClick={fetchMetrics}
          className="ml-auto px-3 py-1.5 rounded text-sm font-medium"
          style={{ color: colors.danger.base }}
        >
          Retry
        </button>
      </div>
    );
  }

  const healthScore = calculateHealth(metrics);
  const customerTotal = metrics.customers.total;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>
          Platform Metrics
        </h1>
        <button
          type="button"
          onClick={fetchMetrics}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
          style={{ borderColor: colors.glass.border, color: colors.text.secondary }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {
            icon: <DollarSign size={20} />,
            label: 'Total MRR',
            value: formatCurrency(metrics.revenue.totalMrr),
            sub: `Avg ${formatCurrency(metrics.revenue.avgMrr)} / customer`,
            color: colors.success.base,
          },
          {
            icon: <Users size={20} />,
            label: 'Active Customers',
            value: metrics.customers.active,
            sub: `${metrics.customers.total} Total (${metrics.customers.trial} in Trial)`,
            color: colors.brand.primary,
          },
          {
            icon: <Server size={20} />,
            label: 'Total Instances',
            value: metrics.instances.total,
            sub: `${metrics.instances.provisioning} Provisioning`,
            color: colors.info.base,
          },
          {
            icon: <Activity size={20} />,
            label: 'System Health',
            value: `${healthScore}%`,
            sub: `${metrics.instances.degraded} Degraded Instances`,
            color: healthScore > 90 ? colors.success.base : colors.warning.base,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-5 rounded-2xl border"
            style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${stat.color}20`, color: stat.color }}
              >
                {stat.icon}
              </div>
              <span className="text-sm" style={{ color: colors.text.tertiary }}>
                {stat.label}
              </span>
            </div>
            <div className="text-2xl font-bold" style={{ color: colors.text.primary }}>
              {stat.value}
            </div>
            <div className="text-xs mt-1" style={{ color: colors.text.secondary }}>
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Customer Tiers */}
        <div
          className="p-5 rounded-2xl border"
          style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
        >
          <h3 className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
            Customer Tiers
          </h3>
          {Object.entries(metrics.customers.byTier).map(([tier, count]) => (
            <div key={tier} className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm capitalize" style={{ color: colors.text.secondary }}>
                  {tier}
                </span>
                <span className="text-sm font-bold" style={{ color: colors.text.primary }}>
                  {count}
                </span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: colors.glass.medium }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${customerTotal > 0 ? (count / customerTotal) * 100 : 0}%`,
                    backgroundColor:
                      tier === 'enterprise'
                        ? colors.brand.primary
                        : tier === 'professional'
                        ? colors.info.base
                        : colors.text.tertiary,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Region Distribution */}
        <div
          className="p-5 rounded-2xl border"
          style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Globe size={20} style={{ color: colors.text.secondary }} />
            <h3 className="text-base font-semibold" style={{ color: colors.text.primary }}>
              Region Distribution
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(metrics.instances.byRegion).map(([region, count]) => (
              <div
                key={region}
                className="p-4 rounded-xl"
                style={{ backgroundColor: colors.glass.subtle }}
              >
                <div className="text-xs mb-1" style={{ color: colors.text.tertiary }}>
                  {region}
                </div>
                <div className="text-xl font-bold" style={{ color: colors.text.primary }}>
                  {count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resource Utilization */}
      <div
        className="p-5 rounded-2xl border"
        style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
      >
        <h3 className="text-base font-semibold mb-6" style={{ color: colors.text.primary }}>
          Resource Utilization (Avg)
        </h3>
        <div className="grid grid-cols-4 gap-8">
          <ResourceBar
            label="vCPU Usage"
            value={metrics.resources.avgCpu}
            icon={<Cpu size={32} />}
            color={colors.brand.primary}
          />
          <ResourceBar
            label="Memory Usage"
            value={metrics.resources.avgMemory}
            icon={<Zap size={32} />}
            color={colors.warning.base}
          />
          <ResourceBar
            label="Disk Usage"
            value={metrics.resources.avgDisk}
            icon={<HardDrive size={32} />}
            color={colors.info.base}
          />
          <ResourceBar
            label="Network Load"
            value={metrics.resources.avgNetwork}
            icon={<Activity size={32} />}
            color={colors.success.base}
          />
        </div>
      </div>
    </div>
  );
}

export default MetricsPage;
