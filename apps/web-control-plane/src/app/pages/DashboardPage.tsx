import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  Skeleton,
} from '@mui/material';
import {
  Building2,
  Server,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { colors } from '../theme/theme';
import { controlPlaneApi, PlatformMetrics } from '../services/api';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  color: string;
  loading?: boolean;
}

function StatCard({ icon, label, value, change, isPositive, color, loading }: StatCardProps) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2.5,
              bgcolor: `${color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
            }}
          >
            {icon}
          </Box>
          {change && (
            <Chip
              size="small"
              icon={isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              label={change}
              sx={{
                bgcolor: isPositive ? colors.success.glow : colors.danger.glow,
                color: isPositive ? colors.success.base : colors.danger.base,
                fontWeight: 600,
                fontSize: 11,
                height: 24,
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
          )}
        </Box>
        <Box sx={{ mt: 2 }}>
          {loading ? (
            <Skeleton variant="text" width={80} height={40} />
          ) : (
            <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text.primary }}>
              {value}
            </Typography>
          )}
          <Typography variant="body2" sx={{ color: colors.text.tertiary, mt: 0.5 }}>
            {label}
          </Typography>
        </Box>
      </CardContent>
    </Card>
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
    <Box
      sx={{
        p: 2,
        bgcolor: bgColor,
        borderRadius: 3,
        textAlign: 'center',
      }}
    >
      <Typography variant="h3" sx={{ fontWeight: 700, color }}>
        {count}
      </Typography>
      <Typography variant="body2" sx={{ color: colors.text.secondary, mt: 0.5 }}>
        {label}
      </Typography>
    </Box>
  );
}

interface ResourceBarProps {
  label: string;
  value: number;
  color: string;
}

function ResourceBar({ label, value, color }: ResourceBarProps) {
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" sx={{ color: colors.text.secondary }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, color: colors.text.primary }}>
          {value.toFixed(0)}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={value}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: colors.glass.medium,
          '& .MuiLinearProgress-bar': {
            bgcolor: color,
            borderRadius: 3,
          },
        }}
      />
    </Box>
  );
}

export function DashboardPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMetrics = async () => {
    try {
      const [metricsData, activityData] = await Promise.all([
        controlPlaneApi.getMetrics(),
        controlPlaneApi.getRecentActivity()
      ]);
      
      // Combine metrics with recent activity
      setMetrics({
        ...metricsData,
        recentActivity: activityData
      } as any); // Cast to any or extend interface loosely for now since PlatformMetrics strictly doesn't have it
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

  // Initial empty state
  const emptyMetrics: PlatformMetrics = {
    customers: { total: 0, active: 0, trial: 0, byTier: { enterprise: 0, professional: 0, starter: 0 } },
    instances: { total: 0, healthy: 0, degraded: 0, provisioning: 0, byEnvironment: { production: 0, staging: 0, development: 0 }, byRegion: {} },
    revenue: { totalMrr: 0, avgMrr: 0 },
    resources: { avgCpu: 0, avgMemory: 0, avgDisk: 0, avgNetwork: 0 },
  };

  const displayMetrics = metrics || emptyMetrics;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: colors.text.primary }}>
          Platform Dashboard
        </Typography>
        <IconButton
          onClick={handleRefresh}
          disabled={refreshing}
          sx={{ color: colors.text.tertiary }}
        >
          <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
        </IconButton>
      </Box>

      {/* Stats Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 2,
          mb: 3,
        }}
      >
        <StatCard
          icon={<Building2 size={24} />}
          label="Total Customers"
          value={displayMetrics.customers.total}
          change="+3"
          isPositive
          color={colors.brand.primary}
          loading={loading}
        />
        <StatCard
          icon={<Server size={24} />}
          label="Active Instances"
          value={displayMetrics.instances.total}
          change="+2"
          isPositive
          color={colors.cyan.base}
          loading={loading}
        />
        <StatCard
          icon={<Users size={24} />}
          label="Total Users"
          value={`${(displayMetrics.customers.total * 420 / 1000).toFixed(0)}K`}
          change="+8%"
          isPositive
          color={colors.success.base}
          loading={loading}
        />
        <StatCard
          icon={<DollarSign size={24} />}
          label="Monthly Revenue"
          value={`$${(displayMetrics.revenue.totalMrr / 1000).toFixed(0)}K`}
          change="+12%"
          isPositive
          color={colors.warning.base}
          loading={loading}
        />
      </Box>

      {/* Health & Resources Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 3 }}>
        {/* Instance Health */}
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: colors.text.primary, mb: 2.5 }}>
              Instance Health
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5 }}>
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
                count={0}
                color={colors.text.muted}
                bgColor={colors.glass.medium}
              />
            </Box>
          </CardContent>
        </Card>

        {/* Resource Usage */}
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: colors.text.primary, mb: 2.5 }}>
              Resource Usage
            </Typography>
            <ResourceBar label="CPU" value={displayMetrics.resources.avgCpu} color={colors.brand.primary} />
            <ResourceBar label="Memory" value={displayMetrics.resources.avgMemory} color={colors.cyan.base} />
            <ResourceBar label="Disk" value={displayMetrics.resources.avgDisk} color={colors.success.base} />
          </CardContent>
        </Card>
      </Box>

      {/* Quick Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, mt: 3 }}>
        {/* By Tier */}
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: colors.text.primary, mb: 2 }}>
              Customers by Tier
            </Typography>
            {Object.entries(displayMetrics.customers.byTier).map(([tier, count]) => (
              <Box
                key={tier}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 1.5,
                  borderBottom: `1px solid ${colors.glass.border}`,
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Chip
                    size="small"
                    label={tier}
                    sx={{
                      bgcolor: tier === 'enterprise' ? colors.brand.glow :
                               tier === 'professional' ? colors.cyan.glow :
                               colors.glass.medium,
                      color: tier === 'enterprise' ? colors.brand.primary :
                             tier === 'professional' ? colors.cyan.base :
                             colors.text.secondary,
                      fontWeight: 600,
                      textTransform: 'capitalize',
                    }}
                  />
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 600, color: colors.text.primary }}>
                  {count}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>

        {/* By Environment */}
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: colors.text.primary, mb: 2 }}>
              Instances by Environment
            </Typography>
            {Object.entries(displayMetrics.instances.byEnvironment).map(([env, count]) => (
              <Box
                key={env}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 1.5,
                  borderBottom: `1px solid ${colors.glass.border}`,
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Chip
                    size="small"
                    label={env}
                    sx={{
                      bgcolor: env === 'production' ? colors.success.glow :
                               env === 'staging' ? colors.warning.glow :
                               colors.info.glow,
                      color: env === 'production' ? colors.success.base :
                             env === 'staging' ? colors.warning.base :
                             colors.info.base,
                      fontWeight: 600,
                      textTransform: 'capitalize',
                    }}
                  />
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 600, color: colors.text.primary }}>
                  {count}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>

            {/* Recent Activity */}
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: colors.text.primary }}>
                Recent Activity
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: colors.brand.primary, cursor: 'pointer', fontWeight: 500 }}
              >
                View all
              </Typography>
            </Box>
            
            {(metrics?.recentActivity || []).length === 0 ? (
                <Typography variant="body2" sx={{ color: colors.text.tertiary, py: 2, textAlign: 'center' }}>
                    No recent activity found.
                </Typography>
            ) : (
                (metrics?.recentActivity || []).map((item: any, i: number) => {
                  const isError = item.severity === 'error' || item.severity === 'critical';
                  const isWarning = item.severity === 'warning';
                  const isSuccess = item.severity === 'info'; // Mapping info to success for visual flair if not strictly error/warning
                  
                  return (
                  <Box
                    key={item.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 1.5,
                      borderBottom: `1px solid ${colors.glass.border}`,
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 2,
                        bgcolor: isError ? colors.danger.glow :
                                 isWarning ? colors.warning.glow :
                                 colors.info.glow,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Activity
                        size={14}
                        color={
                          isError ? colors.danger.base :
                          isWarning ? colors.warning.base :
                          colors.info.base
                        }
                      />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ color: colors.text.primary, fontWeight: 500 }}>
                        {item.description}
                      </Typography>
                      <Typography variant="caption" sx={{ color: colors.text.muted }}>
                        {item.target} • {new Date(item.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                )})
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

export default DashboardPage;
