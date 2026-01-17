import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Shield,
  TrendingUp,
  Zap,
  Database,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import {
  predictiveOpsApi,
  PredictiveInsight,
  PredictiveOpsDashboard as DashboardData,
} from '../../../services/phase7Api';

const severityStyles = {
  info: {
    badge: 'bg-info-subtle text-info-text',
    icon: 'bg-info-subtle',
    iconColor: 'text-info-text',
  },
  warning: {
    badge: 'bg-warning-subtle text-warning-text',
    icon: 'bg-warning-subtle',
    iconColor: 'text-warning-text',
  },
  critical: {
    badge: 'bg-danger-subtle text-danger-text',
    icon: 'bg-danger-subtle',
    iconColor: 'text-danger-text',
  },
};

const typeIcons: Record<string, React.ElementType> = {
  capacity: Database,
  security: Shield,
  performance: Zap,
  compliance: CheckCircle,
  usage: TrendingUp,
};

export const PredictiveOpsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [insights, setInsights] = useState<PredictiveInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [runningAnalysis, setRunningAnalysis] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    loadInsights();
  }, [typeFilter, statusFilter]);

  const loadDashboard = async () => {
    try {
      const data = await predictiveOpsApi.getDashboard();
      setDashboard(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async () => {
    try {
      const params: Record<string, string | number> = { limit: 50 };
      if (typeFilter !== 'all') params.type = typeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await predictiveOpsApi.getInsights(params);
      setInsights(response?.insights ?? []);
    } catch (error) {
      console.error('Failed to load insights:', error);
      setInsights([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDashboard(), loadInsights()]);
    setRefreshing(false);
  };

  const handleTriggerAnalysis = async (type: string) => {
    setRunningAnalysis(type);
    try {
      await predictiveOpsApi.triggerAnalysis(type);
      setTimeout(() => {
        loadDashboard();
        loadInsights();
        setRunningAnalysis(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to trigger analysis:', error);
      setRunningAnalysis(null);
    }
  };

  const handleResolveInsight = async (id: string) => {
    try {
      await predictiveOpsApi.resolveInsight(id, 'Resolved via dashboard');
      loadInsights();
      loadDashboard();
    } catch (error) {
      console.error('Failed to resolve insight:', error);
    }
  };

  const handleDismissInsight = async (id: string) => {
    try {
      await predictiveOpsApi.dismissInsight(id, 'Dismissed via dashboard');
      loadInsights();
      loadDashboard();
    } catch (error) {
      console.error('Failed to dismiss insight:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 rounded bg-muted" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 rounded-xl bg-muted" />
            ))}
          </div>
          <div className="h-96 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  const analysisTypes = [
    { type: 'capacity', label: 'Capacity', icon: Database },
    { type: 'security', label: 'Security', icon: Shield },
    { type: 'performance', label: 'Performance', icon: Zap },
    { type: 'compliance', label: 'Compliance', icon: CheckCircle },
    { type: 'usage', label: 'Usage', icon: TrendingUp },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Predictive Operations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered insights and proactive recommendations
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-card border border-border text-foreground hover:bg-muted"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Total Insights
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {dashboard?.totalInsights || 0}
              </p>
            </div>
          </div>
        </div>

        <div
          className="rounded-xl border border-border bg-card p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setStatusFilter('open')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-subtle">
              <Clock className="h-5 w-5 text-warning-text" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Open
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {dashboard?.openCount || 0}
              </p>
            </div>
          </div>
        </div>

        <div
          className="rounded-xl border border-border bg-card p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => {
            setTypeFilter('all');
            setStatusFilter('all');
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-danger-subtle">
              <AlertTriangle className="h-5 w-5 text-danger-text" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Critical
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {dashboard?.criticalCount || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-subtle">
              <AlertTriangle className="h-5 w-5 text-warning-text" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Warnings
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {dashboard?.warningCount || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Triggers */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-medium mb-4 text-foreground">
          Run Analysis
        </h2>
        <div className="flex flex-wrap gap-3">
          {analysisTypes.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => handleTriggerAnalysis(type)}
              disabled={runningAnalysis === type}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-border transition-colors hover:shadow-sm text-foreground ${
                runningAnalysis === type ? 'bg-muted' : 'bg-background hover:bg-muted'
              }`}
            >
              {runningAnalysis === type ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Type:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border text-sm bg-card text-foreground"
          >
            <option value="all">All Types</option>
            <option value="capacity">Capacity</option>
            <option value="security">Security</option>
            <option value="performance">Performance</option>
            <option value="compliance">Compliance</option>
            <option value="usage">Usage</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border text-sm bg-card text-foreground"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {/* Insights List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-lg font-medium text-foreground">
            Insights ({insights.length})
          </h2>
        </div>
        <div className="divide-y divide-border">
          {insights.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-success-text" />
              <p className="text-lg font-medium text-foreground">
                No insights found
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Run an analysis to generate predictive insights
              </p>
            </div>
          ) : (
            insights.map((insight) => {
              const Icon = typeIcons[insight.type] || Activity;
              const styles = severityStyles[insight.severity];

              return (
                <div
                  key={insight.id}
                  className="p-4 transition-colors cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/studio/phase7/predictive-ops/insights/${insight.id}`)}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg shrink-0 ${styles.icon}`}>
                      <Icon className={`h-5 w-5 ${styles.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate text-foreground">
                          {insight.title}
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles.badge}`}>
                          {insight.severity}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                          {insight.status}
                        </span>
                      </div>
                      <p className="text-sm line-clamp-2 text-muted-foreground">
                        {insight.description}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground/70">
                        <span>Confidence: {Math.round(insight.confidence * 100)}%</span>
                        <span>{new Date(insight.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {insight.status === 'open' && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResolveInsight(insight.id);
                            }}
                            className="p-2 rounded-lg transition-colors bg-success-subtle hover:bg-success-subtle"
                            title="Mark as resolved"
                          >
                            <CheckCircle className="h-4 w-4 text-success-text" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismissInsight(insight.id);
                            }}
                            className="p-2 rounded-lg transition-colors bg-muted hover:bg-muted/80"
                            title="Dismiss"
                          >
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </>
                      )}
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Running Jobs */}
      {dashboard?.jobs && dashboard.jobs.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-medium mb-4 text-foreground">
            Recent Analysis Jobs
          </h2>
          <div className="space-y-3">
            {dashboard.jobs.slice(0, 5).map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 rounded-lg bg-background"
              >
                <div className="flex items-center gap-3">
                  {job.status === 'running' ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  ) : job.status === 'completed' ? (
                    <CheckCircle className="h-4 w-4 text-success-text" />
                  ) : job.status === 'failed' ? (
                    <XCircle className="h-4 w-4 text-danger-text" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-foreground">{job.type} Analysis</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {job.insightsGenerated > 0 && (
                    <span>{job.insightsGenerated} insights</span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      job.status === 'completed'
                        ? 'bg-success-subtle text-success-text'
                        : job.status === 'running'
                        ? 'bg-info-subtle text-info-text'
                        : job.status === 'failed'
                        ? 'bg-danger-subtle text-danger-text'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictiveOpsDashboard;
