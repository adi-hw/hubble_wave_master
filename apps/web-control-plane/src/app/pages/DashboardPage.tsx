import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Server,
  Users,
  DollarSign,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi, PlatformMetrics } from '../services/api';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  loading?: boolean;
}

function StatCard({ icon, label, value, color, loading }: StatCardProps) {
  return (
    <div
      className="p-5 rounded-2xl border"
      style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {icon}
        </div>
      </div>
      <div className="mt-4">
        {loading ? (
          <div
            className="h-10 w-20 rounded animate-pulse"
            style={{ backgroundColor: colors.glass.medium }}
          />
        ) : (
          <div className="text-2xl font-bold" style={{ color: colors.text.primary }}>
            {value}
          </div>
        )}
        <div className="text-sm mt-1" style={{ color: colors.text.tertiary }}>
          {label}
        </div>
      </div>
    </div>
  );
}

interface HealthCardProps {
  label: string;
  count: number;
  color: string;
  bgColor: string;
}

function HealthCard({ label, count, color, bgColor }: HealthCardProps) {
  return (
    <div className="p-4 rounded-xl text-center" style={{ backgroundColor: bgColor }}>
      <div className="text-xl font-bold" style={{ color }}>
        {count}
      </div>
      <div className="text-sm mt-1" style={{ color: colors.text.secondary }}>
        {label}
      </div>
    </div>
  );
}

interface ResourceBarProps {
  label: string;
  value: number;
  color: string;
}

function ResourceBar({ label, value, color }: ResourceBarProps) {
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-2">
        <span className="text-sm" style={{ color: colors.text.secondary }}>
          {label}
        </span>
        <span className="text-sm font-semibold" style={{ color: colors.text.primary }}>
          {value.toFixed(0)}%
        </span>
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

export function DashboardPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMetrics = async () => {
    try {
      const [metricsData, activityData] = await Promise.all([
        controlPlaneApi.getMetrics(),
        controlPlaneApi.getRecentActivity(),
      ]);

      setMetrics({
        ...metricsData,
        recentActivity: activityData,
      });
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMetrics();
  };

  const emptyMetrics: PlatformMetrics = {
    customers: {
      total: 0,
      active: 0,
      trial: 0,
      byTier: { enterprise: 0, professional: 0, starter: 0 },
      totalUsers: 0,
      totalAssets: 0,
    },
    instances: {
      total: 0,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      unknown: 0,
      provisioning: 0,
      byEnvironment: { production: 0, staging: 0, dev: 0 },
      byRegion: {},
    },
    revenue: { totalMrr: 0, avgMrr: 0 },
    resources: { avgCpu: 0, avgMemory: 0, avgDisk: 0, avgNetwork: 0 },
  };

  const displayMetrics = metrics || emptyMetrics;
  const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  const unhealthyInstances = displayMetrics.instances.unhealthy ?? 0;
  const unknownInstances = displayMetrics.instances.unknown
    ?? Math.max(
      0,
      displayMetrics.instances.total
        - displayMetrics.instances.healthy
        - displayMetrics.instances.degraded
        - unhealthyInstances
        - displayMetrics.instances.provisioning
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>
          Platform Dashboard
        </h1>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg transition-colors disabled:opacity-50"
          style={{ color: colors.text.tertiary }}
        >
          <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Building2 size={24} />}
          label="Total Customers"
          value={formatNumber(displayMetrics.customers.total)}
          color={colors.brand.primary}
          loading={loading}
        />
        <StatCard
          icon={<Server size={24} />}
          label="Total Instances"
          value={formatNumber(displayMetrics.instances.total)}
          color={colors.cyan.base}
          loading={loading}
        />
        <StatCard
          icon={<Users size={24} />}
          label="Total Users"
          value={formatNumber(displayMetrics.customers.totalUsers)}
          color={colors.success.base}
          loading={loading}
        />
        <StatCard
          icon={<DollarSign size={24} />}
          label="Monthly Revenue"
          value={formatCurrency(displayMetrics.revenue.totalMrr)}
          color={colors.warning.base}
          loading={loading}
        />
      </div>

      {/* Health & Resources Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Instance Health */}
        <div
          className="col-span-2 p-5 rounded-2xl border"
          style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
        >
          <h3 className="text-base font-semibold mb-5" style={{ color: colors.text.primary }}>
            Instance Health
          </h3>
          <div className="grid grid-cols-4 gap-3">
            <HealthCard
              label="Healthy"
              count={displayMetrics.instances.healthy}
              color={colors.success.base}
              bgColor={colors.success.glow}
            />
            <HealthCard
              label="Degraded"
              count={displayMetrics.instances.degraded}
              color={colors.warning.base}
              bgColor={colors.warning.glow}
            />
            <HealthCard
              label="Provisioning"
              count={displayMetrics.instances.provisioning}
              color={colors.info.base}
              bgColor={colors.info.glow}
            />
            <HealthCard
              label="Unknown"
              count={unknownInstances}
              color={colors.text.muted}
              bgColor={colors.glass.medium}
            />
          </div>
        </div>

        {/* Resource Usage */}
        <div
          className="p-5 rounded-2xl border"
          style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
        >
          <h3 className="text-base font-semibold mb-5" style={{ color: colors.text.primary }}>
            Resource Usage
          </h3>
          <ResourceBar label="CPU" value={displayMetrics.resources.avgCpu} color={colors.brand.primary} />
          <ResourceBar label="Memory" value={displayMetrics.resources.avgMemory} color={colors.cyan.base} />
          <ResourceBar label="Disk" value={displayMetrics.resources.avgDisk} color={colors.success.base} />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-6 mt-6">
        {/* By Tier */}
        <div
          className="p-5 rounded-2xl border"
          style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
        >
          <h3 className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
            Customers by Tier
          </h3>
          {Object.entries(displayMetrics.customers.byTier).map(([tier, count]) => (
            <div
              key={tier}
              className="flex items-center justify-between py-3"
              style={{ borderBottom: `1px solid ${colors.glass.border}` }}
            >
              <span
                className="px-2 py-1 rounded-md text-xs font-semibold capitalize"
                style={{
                  backgroundColor:
                    tier === 'enterprise'
                      ? colors.brand.glow
                      : tier === 'professional'
                      ? colors.cyan.glow
                      : colors.glass.medium,
                  color:
                    tier === 'enterprise'
                      ? colors.brand.primary
                      : tier === 'professional'
                      ? colors.cyan.base
                      : colors.text.secondary,
                }}
              >
                {tier}
              </span>
              <span className="text-sm font-semibold" style={{ color: colors.text.primary }}>
                {count}
              </span>
            </div>
          ))}
        </div>

        {/* By Environment */}
        <div
          className="p-5 rounded-2xl border"
          style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
        >
          <h3 className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
            Instances by Environment
          </h3>
          {Object.entries(displayMetrics.instances.byEnvironment).map(([env, count]) => (
            <div
              key={env}
              className="flex items-center justify-between py-3"
              style={{ borderBottom: `1px solid ${colors.glass.border}` }}
            >
              <span
                className="px-2 py-1 rounded-md text-xs font-semibold capitalize"
                style={{
                  backgroundColor:
                    env === 'production'
                      ? colors.success.glow
                      : env === 'staging'
                      ? colors.warning.glow
                      : colors.info.glow,
                  color:
                    env === 'production'
                      ? colors.success.base
                      : env === 'staging'
                      ? colors.warning.base
                      : colors.info.base,
                }}
              >
                {env}
              </span>
              <span className="text-sm font-semibold" style={{ color: colors.text.primary }}>
                {count}
              </span>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div
          className="p-5 rounded-2xl border"
          style={{ backgroundColor: colors.void.base, borderColor: colors.glass.border }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold" style={{ color: colors.text.primary }}>
              Recent Activity
            </h3>
            <button
              type="button"
              onClick={() => navigate('/audit')}
              className="text-xs font-medium cursor-pointer"
              style={{ color: colors.brand.primary }}
            >
              View all
            </button>
          </div>

          {(metrics?.recentActivity || []).length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: colors.text.tertiary }}>
              No recent activity found.
            </p>
          ) : (
            (metrics?.recentActivity || []).map((item: any) => {
              const isError = item.severity === 'error' || item.severity === 'critical';
              const isWarning = item.severity === 'warning';

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 py-3"
                  style={{ borderBottom: `1px solid ${colors.glass.border}` }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: isError
                        ? colors.danger.glow
                        : isWarning
                        ? colors.warning.glow
                        : colors.info.glow,
                    }}
                  >
                    <Activity
                      size={14}
                      style={{
                        color: isError
                          ? colors.danger.base
                          : isWarning
                          ? colors.warning.base
                          : colors.info.base,
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: colors.text.primary }}>
                      {item.description}
                    </p>
                    <p className="text-xs truncate" style={{ color: colors.text.muted }}>
                      {item.target} • {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
