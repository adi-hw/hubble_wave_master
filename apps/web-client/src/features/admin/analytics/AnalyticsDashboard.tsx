import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Activity,
  BarChart3,
  Clock,
  RefreshCw,
  Calendar,
  Database,
} from 'lucide-react';
import { Card } from '../../../components/ui/Card';

type TimePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year';

interface MetricCard {
  id: string;
  label: string;
  value: number;
  previousValue: number;
  icon: React.ElementType;
  color: string;
}

interface TopItem {
  id: string;
  label: string;
  count: number;
}

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  user: string;
  timestamp: string;
}

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState<TimePeriod>('week');
  const [loading, setLoading] = useState(false);

  // Mock data - would be fetched from API
  const [metrics] = useState<MetricCard[]>([
    {
      id: 'users',
      label: 'Active Users',
      value: 247,
      previousValue: 219,
      icon: Users,
      color: 'blue',
    },
    {
      id: 'records',
      label: 'Records Created',
      value: 1842,
      previousValue: 1567,
      icon: FileText,
      color: 'green',
    },
    {
      id: 'updates',
      label: 'Records Updated',
      value: 4521,
      previousValue: 4892,
      icon: Activity,
      color: 'amber',
    },
    {
      id: 'automations',
      label: 'Automations Run',
      value: 892,
      previousValue: 756,
      icon: BarChart3,
      color: 'purple',
    },
  ]);

  const [topCollections] = useState<TopItem[]>([
    { id: '1', label: 'Incidents', count: 4521 },
    { id: '2', label: 'Assets', count: 2847 },
    { id: '3', label: 'Changes', count: 1923 },
    { id: '4', label: 'Problems', count: 876 },
    { id: '5', label: 'Service Requests', count: 654 },
  ]);

  const [topUsers] = useState<TopItem[]>([
    { id: '1', label: 'john.smith@company.com', count: 892 },
    { id: '2', label: 'jane.doe@company.com', count: 756 },
    { id: '3', label: 'mike.wilson@company.com', count: 623 },
    { id: '4', label: 'sarah.johnson@company.com', count: 521 },
    { id: '5', label: 'tom.brown@company.com', count: 412 },
  ]);

  const [recentActivity] = useState<ActivityItem[]>([
    {
      id: '1',
      type: 'record_create',
      description: 'Created incident INC0012345',
      user: 'john.smith@company.com',
      timestamp: '2 minutes ago',
    },
    {
      id: '2',
      type: 'record_update',
      description: 'Updated asset AST0000042',
      user: 'jane.doe@company.com',
      timestamp: '5 minutes ago',
    },
    {
      id: '3',
      type: 'workflow',
      description: 'Workflow "Incident Escalation" completed',
      user: 'system',
      timestamp: '8 minutes ago',
    },
    {
      id: '4',
      type: 'record_create',
      description: 'Created change CHG0001234',
      user: 'mike.wilson@company.com',
      timestamp: '12 minutes ago',
    },
    {
      id: '5',
      type: 'notification',
      description: 'Sent email notification to 15 users',
      user: 'system',
      timestamp: '15 minutes ago',
    },
  ]);

  // Mock chart data
  const chartData = [
    { day: 'Mon', records: 420, users: 45 },
    { day: 'Tue', records: 380, users: 42 },
    { day: 'Wed', records: 550, users: 58 },
    { day: 'Thu', records: 490, users: 52 },
    { day: 'Fri', records: 620, users: 61 },
    { day: 'Sat', records: 180, users: 22 },
    { day: 'Sun', records: 140, users: 18 },
  ];

  const maxRecords = Math.max(...chartData.map((d) => d.records));

  useEffect(() => {
    // Simulate loading
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [period]);

  const getChangePercent = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
      purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    };
    return colorMap[color] || colorMap.blue;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Analytics Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor platform usage and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            {(['today', 'week', 'month', 'quarter', 'year'] as TimePeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  period === p
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setLoading(true)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const change = getChangePercent(metric.value, metric.previousValue);
          const isPositive = change >= 0;
          const Icon = metric.icon;

          return (
            <Card key={metric.id} className="hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-lg ${getColorClass(metric.color)}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className={`flex items-center text-sm font-medium ${
                    isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {isPositive ? (
                      <TrendingUp className="w-4 h-4 mr-1" />
                    ) : (
                      <TrendingDown className="w-4 h-4 mr-1" />
                    )}
                    {Math.abs(change).toFixed(1)}%
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {metric.value.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{metric.label}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Chart */}
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 dark:text-white">Activity Overview</h3>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-indigo-500" />
                  <span className="text-gray-500 dark:text-gray-400">Records</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-emerald-500" />
                  <span className="text-gray-500 dark:text-gray-400">Users</span>
                </div>
              </div>
            </div>
            {/* Simple Bar Chart */}
            <div className="h-64 flex items-end gap-2">
              {chartData.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center gap-0.5">
                    <div
                      className="w-full bg-indigo-500 rounded-t"
                      style={{ height: `${(d.records / maxRecords) * 180}px` }}
                    />
                    <div
                      className="w-full bg-emerald-500 rounded-t opacity-70"
                      style={{ height: `${(d.users / maxRecords) * 180}px` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{d.day}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Trend Chart */}
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 dark:text-white">Record Activity Trend</h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">Last 7 days</span>
            </div>
            {/* Simple Line Chart Visualization */}
            <div className="h-64 flex flex-col">
              <div className="flex-1 relative">
                <svg className="w-full h-full" viewBox="0 0 300 180">
                  {/* Grid lines */}
                  {[0, 1, 2, 3].map((i) => (
                    <line
                      key={i}
                      x1="0"
                      y1={45 * i}
                      x2="300"
                      y2={45 * i}
                      stroke="currentColor"
                      strokeWidth="1"
                      className="text-gray-200 dark:text-gray-700"
                    />
                  ))}
                  {/* Line */}
                  <polyline
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2"
                    points={chartData
                      .map((d, i) => `${(i / (chartData.length - 1)) * 280 + 10},${180 - (d.records / maxRecords) * 160}`)
                      .join(' ')}
                  />
                  {/* Area under line */}
                  <polygon
                    fill="url(#gradient)"
                    opacity="0.3"
                    points={`10,180 ${chartData
                      .map((d, i) => `${(i / (chartData.length - 1)) * 280 + 10},${180 - (d.records / maxRecords) * 160}`)
                      .join(' ')} 290,180`}
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Data points */}
                  {chartData.map((d, i) => (
                    <circle
                      key={d.day}
                      cx={(i / (chartData.length - 1)) * 280 + 10}
                      cy={180 - (d.records / maxRecords) * 160}
                      r="4"
                      fill="#6366f1"
                    />
                  ))}
                </svg>
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                {chartData.map((d) => (
                  <span key={d.day}>{d.day}</span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Lists Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Collections */}
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-gray-400" />
              <h3 className="font-medium text-gray-900 dark:text-white">Top Collections</h3>
            </div>
            <div className="space-y-3">
              {topCollections.map((item, index) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 flex items-center justify-center rounded text-xs font-medium ${
                      index === 0
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="text-gray-900 dark:text-white">{item.label}</span>
                  </div>
                  <span className="text-gray-500 dark:text-gray-400 font-medium">
                    {item.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Top Users */}
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-gray-400" />
              <h3 className="font-medium text-gray-900 dark:text-white">Most Active Users</h3>
            </div>
            <div className="space-y-3">
              {topUsers.map((item, index) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 flex items-center justify-center rounded text-xs font-medium ${
                      index === 0
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="text-gray-900 dark:text-white text-sm truncate max-w-[160px]">
                      {item.label.split('@')[0]}
                    </span>
                  </div>
                  <span className="text-gray-500 dark:text-gray-400 font-medium">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-gray-400" />
              <h3 className="font-medium text-gray-900 dark:text-white">Recent Activity</h3>
            </div>
            <div className="space-y-3">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    item.type === 'record_create'
                      ? 'bg-green-500'
                      : item.type === 'record_update'
                      ? 'bg-blue-500'
                      : item.type === 'workflow'
                      ? 'bg-purple-500'
                      : 'bg-amber-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white truncate">
                      {item.description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.user === 'system' ? 'System' : item.user.split('@')[0]} · {item.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-gray-400" />
              <h3 className="font-medium text-gray-900 dark:text-white">System Health</h3>
            </div>
            <span className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              All Systems Operational
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">API Response Time</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1">42ms</p>
              <div className="flex items-center gap-1 mt-2">
                <TrendingDown className="w-3 h-3 text-green-500" />
                <span className="text-xs text-green-600 dark:text-green-400">8% faster</span>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">Database Queries</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1">12.4k/hr</p>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="w-3 h-3 text-amber-500" />
                <span className="text-xs text-amber-600 dark:text-amber-400">+12% load</span>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">Error Rate</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1">0.02%</p>
              <div className="flex items-center gap-1 mt-2">
                <TrendingDown className="w-3 h-3 text-green-500" />
                <span className="text-xs text-green-600 dark:text-green-400">-15% errors</span>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">Uptime</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1">99.99%</p>
              <div className="flex items-center gap-1 mt-2">
                <Calendar className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Last 30 days</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
